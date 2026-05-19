import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";
import * as XLSX from "xlsx";
import { blockIfMustChangePassword, requireAuth, requireRight } from "../middlewares/auth";

const router: IRouter = Router();

// ── Template CSV (public — no auth required) ──────────────────────────────────
// Registered before the auth middleware so Linking.openURL works without a token.

router.get("/checklists/import/spreadsheet/template", (_req: Request, res: Response) => {
  const csv = [
    "section,task,required,subsection",
    "Opening Tasks,Count the register,Y,",
    "Opening Tasks,Check refrigerator temps,N,Equipment",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="checklist-template.csv"');
  res.send(csv);
});

router.use(requireAuth, blockIfMustChangePassword);

// ── Multer setup ──────────────────────────────────────────────────────────────

const ACCEPTED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "text/csv",
  "text/plain",
  "application/csv",
  "application/octet-stream",
]);

const ACCEPTED_EXTS = new Set([".xlsx", ".xls", ".csv"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => {
      cb(null, `endshift-${Date.now()}-${Math.random().toString(36).slice(2)}.sheet`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    const ok = ACCEPTED_MIMES.has(file.mimetype) || ACCEPTED_EXTS.has(ext);
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Only spreadsheet files (.xlsx, .xls, .csv) are accepted"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportTask {
  text: string;
  required: boolean;
  subsection: string | null;
}

interface ImportSection {
  title: string;
  tasks: ImportTask[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

const REQUIRED_VALUES = new Set(["y", "yes", "true", "1"]);

function parseSpreadsheet(buffer: Buffer): { sections: ImportSection[] } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The spreadsheet appears to be empty.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("The spreadsheet has no data rows.");
  }

  // Normalise headers to lowercase for flexible matching
  const normalised = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.trim().toLowerCase()] = String(v ?? "").trim();
    }
    return out;
  });

  const firstRow = normalised[0];
  const hasTask = "task" in firstRow || "text" in firstRow;
  if (!hasTask) {
    throw Object.assign(
      new Error(
        'No "task" or "text" column found in the spreadsheet. ' +
          'Expected column headers: section, task (or text), required, subsection.',
      ),
      { statusCode: 422 },
    );
  }

  const sectionsMap = new Map<string, ImportSection>();
  const sectionOrder: string[] = [];

  for (const row of normalised) {
    const taskText = (row["task"] ?? row["text"] ?? "").trim();
    if (!taskText) continue;

    const sectionTitle = (row["section"] ?? "General Tasks").trim() || "General Tasks";
    const subsection = (row["subsection"] ?? "").trim() || null;
    const reqRaw = (row["required"] ?? "").toLowerCase().trim();
    const required = REQUIRED_VALUES.has(reqRaw);

    if (!sectionsMap.has(sectionTitle)) {
      sectionsMap.set(sectionTitle, { title: sectionTitle, tasks: [] });
      sectionOrder.push(sectionTitle);
    }

    sectionsMap.get(sectionTitle)!.tasks.push({ text: taskText, required, subsection });
  }

  const sections = sectionOrder
    .map((t) => sectionsMap.get(t)!)
    .filter((s) => s.tasks.length > 0);

  return {
    sections: sections.length > 0 ? sections : [{ title: "General Tasks", tasks: [] }],
  };
}

// ── Multer error handler ──────────────────────────────────────────────────────

function handleMulterError(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError || err instanceof Error) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post(
  "/checklists/import/spreadsheet",
  requireRight("create_checklists"),
  upload.single("file"),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No spreadsheet file uploaded" });
      return;
    }

    const inputPath = req.file.path;
    try {
      const buffer = await fs.readFile(inputPath);

      let result: { sections: ImportSection[] };
      try {
        result = parseSpreadsheet(buffer);
      } catch (parseErr: unknown) {
        const err = parseErr as Error & { statusCode?: number };
        const status = err.statusCode === 422 ? 422 : 400;
        res.status(status).json({ error: err.message });
        return;
      }

      const taskCount = result.sections.reduce((n, s) => n + s.tasks.length, 0);
      req.log.info({ sections: result.sections.length, tasks: taskCount }, "spreadsheet parsed");

      res.json(result);
    } finally {
      await fs.unlink(inputPath).catch(() => {});
    }
  },
);

export default router;
