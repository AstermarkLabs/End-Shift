import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pdfParse from "pdf-parse";
import { blockIfMustChangePassword, requireAuth, requireRight } from "../middlewares/auth";

const execFileAsync = promisify(execFile);

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

// ── Multer setup ──────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => {
      cb(null, `endshift-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Rule-based PDF parser ─────────────────────────────────────────────────────

interface PdfTask {
  text: string;
  required: boolean;
}

interface PdfSection {
  title: string;
  tasks: PdfTask[];
}

const TASK_PREFIX =
  /^(?:[-*•·→✓☐☑✗✘▸▹◦]|\[[\s xX]?\]|\d{1,2}[.)]\s|\([a-z]\)\s)/;

const REQUIRED_MARKER = /\b(?:required|mandatory|must)\b/i;

function isTaskLine(line: string): boolean {
  return TASK_PREFIX.test(line);
}

function isSectionHeader(line: string): boolean {
  if (isTaskLine(line)) return false;
  if (line.endsWith(":") && line.length > 3) return true;
  const letters = line.replace(/[^a-zA-Z]/g, "");
  const uppers = line.replace(/[^A-Z]/g, "");
  return letters.length >= 4 && uppers.length / letters.length >= 0.7;
}

function cleanTaskText(raw: string): string {
  return raw
    .replace(/^(?:[-*•·→✓☐☑✗✘▸▹◦]|\[[\s xX]?\]\s*|\d{1,2}[.)]\s|\([a-z]\)\s)\s*/, "")
    .replace(/\s*\(\s*required\s*\)\s*$/i, "")
    .replace(/\s*\*\s*$/, "")
    .trim();
}

function cleanSectionTitle(raw: string): string {
  return raw.replace(/:+$/, "").replace(/^#+\s*/, "").trim();
}

function isRequired(line: string): boolean {
  return REQUIRED_MARKER.test(line) || line.trimEnd().endsWith("*");
}

function parsePdfText(text: string): { sections: PdfSection[] } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const sections: PdfSection[] = [];
  let current: PdfSection = { title: "General Tasks", tasks: [] };
  let headerSeen = false;

  for (const line of lines) {
    if (/^[-=_]{2,}$/.test(line)) continue;

    if (isSectionHeader(line)) {
      if (headerSeen || current.tasks.length > 0) {
        sections.push(current);
        current = { title: cleanSectionTitle(line), tasks: [] };
        headerSeen = true;
      } else {
        current.title = cleanSectionTitle(line);
        headerSeen = true;
      }
    } else if (isTaskLine(line)) {
      const text = cleanTaskText(line);
      if (text.length > 0) {
        current.tasks.push({ text, required: isRequired(line) });
      }
    }
  }

  if (current.tasks.length > 0) sections.push(current);

  const nonEmpty = sections.filter((s) => s.tasks.length > 0);
  return {
    sections:
      nonEmpty.length > 0 ? nonEmpty : [{ title: "General Tasks", tasks: [] }],
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
  "/checklists/import/pdf",
  requireRight("create_checklists"),
  upload.single("file"),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No PDF file uploaded" });
      return;
    }

    const inputPath = req.file.path;
    const outputPath = `${inputPath}-ocr.pdf`;

    try {
      let parsePath = inputPath;

      try {
        await execFileAsync("ocrmypdf", [
          "--skip-text",
          "--quiet",
          inputPath,
          outputPath,
        ]);
        parsePath = outputPath;
      } catch (ocrErr) {
        req.log.warn({ err: ocrErr }, "ocrmypdf failed; falling back to raw PDF parse");
      }

      const buffer = await fs.readFile(parsePath);
      const parsed = await pdfParse(buffer);

      if (!parsed.text || parsed.text.trim().length === 0) {
        res.status(422).json({
          error:
            "Could not extract text from this PDF. It may be an image-only scan that ocrmypdf could not process.",
        });
        return;
      }

      const result = parsePdfText(parsed.text);
      res.json(result);
    } finally {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  },
);

export default router;
