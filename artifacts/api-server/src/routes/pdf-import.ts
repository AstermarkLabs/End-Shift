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

// Lines that start with an explicit bullet/checkbox/number prefix
const EXPLICIT_PREFIX =
  /^(?:[-*•·→✓☐☑✗✘▸▹◦]|\[[\s xX]?\]|\d{1,3}[.)]\s+|\([a-zA-Z0-9]\)\s+)/;

const REQUIRED_MARKER = /\b(?:required|mandatory|must)\b/i;

// Page numbers, separators, and other noise to skip entirely
const SKIP_LINE =
  /^[-=_]{2,}$|^\d{1,4}$|^page\s+\d/i;

function isSectionHeader(line: string): boolean {
  if (EXPLICIT_PREFIX.test(line)) return false;
  // Ends with colon (e.g. "Opening Tasks:")
  if (line.endsWith(":") && line.length > 3 && line.length < 80) return true;
  // Starts with a Roman numeral or numbered section heading like "I.", "II.", "1."
  if (/^(?:[IVX]+\.|[A-Z]\.|Section\s+\d)/i.test(line) && line.length < 60) return true;
  // ALL CAPS with at least 4 letters and <60 chars (typical section heading)
  const letters = line.replace(/[^a-zA-Z]/g, "");
  const uppers = line.replace(/[^A-Z]/g, "");
  return (
    letters.length >= 4 &&
    line.length < 60 &&
    uppers.length / letters.length >= 0.75
  );
}

function stripPrefix(raw: string): string {
  return raw
    .replace(/^(?:[-*•·→✓☐☑✗✘▸▹◦]|\[[\s xX]?\]\s*|\d{1,3}[.)]\s+|\([a-zA-Z0-9]\)\s+)\s*/, "")
    .replace(/\s*\(\s*required\s*\)\s*$/i, "")
    .replace(/\s*\*\s*$/, "")
    .trim();
}

function cleanSectionTitle(raw: string): string {
  return raw.replace(/:+$/, "").replace(/^#+\s*/, "").replace(/^(?:[IVX]+\.|[A-Z]\.)\s*/i, "").trim();
}

function isRequired(line: string): boolean {
  return REQUIRED_MARKER.test(line) || line.trimEnd().endsWith("*");
}

/**
 * Decide whether a line looks like a useful task candidate in permissive mode.
 *
 * @param inSection - true once the first section header has been seen.
 *   Column headers / form labels (Date, Completed, Initials…) appear in the
 *   document preamble BEFORE any section, so we apply a tighter word-count
 *   filter there. Once inside a section we relax it so that short-but-real
 *   tasks like "Opening Cash" or "Closing Cash" are kept.
 */
function isUsableLine(line: string, inSection: boolean): boolean {
  if (line.length < 4 || line.length > 250) return false;
  if (SKIP_LINE.test(line)) return false;
  // Skip copyright / legal boilerplate lines
  if (
    /©|all rights reserved|confidential.*proprietary|proprietary.*confidential/i.test(
      line,
    )
  )
    return false;
  // Reject lines that are mostly punctuation / symbols
  const alphaNum = line.replace(/[^a-zA-Z0-9]/g, "");
  if (alphaNum.length < 3) return false;

  // Evaluate word count on the cleaned text (after stripping any task prefix)
  // so "✓  Initials  Notes" is judged as "Initials Notes", not as "✓ ..."
  const cleaned = stripPrefix(line).trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);

  // Single-word lines are always form labels — reject everywhere
  if (words.length <= 1) return false;

  // Short 2-word lines in the preamble are column headers (Date, Initials, Notes…).
  // Once we're inside a named section they are real tasks (Opening Cash, etc.).
  if (!inSection && words.length === 2 && cleaned.length < 16) return false;

  return true;
}

function parsePdfText(text: string): { sections: PdfSection[] } {
  const raw = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // ── Mode detection ──────────────────────────────────────────────────────────
  // Count lines that carry an explicit prefix (bullet, checkbox, number).
  // If we have at least 3, use strict prefix-based parsing.
  // Otherwise fall back to permissive mode where every substantive non-header
  // line is treated as a task.
  const explicitCount = raw.filter((l) => EXPLICIT_PREFIX.test(l)).length;
  const useStrict = explicitCount >= 3;

  // ── Build sections ──────────────────────────────────────────────────────────
  const sections: PdfSection[] = [];
  let current: PdfSection = { title: "General Tasks", tasks: [] };
  let headerSeen = false;

  for (const line of raw) {
    if (SKIP_LINE.test(line)) continue;

    if (isSectionHeader(line)) {
      // Flush the in-progress section when we hit a new header
      if (headerSeen || current.tasks.length > 0) {
        sections.push(current);
        current = { title: cleanSectionTitle(line), tasks: [] };
        headerSeen = true;
      } else {
        // First header before any tasks — use it as the section title
        current.title = cleanSectionTitle(line);
        headerSeen = true;
      }
      continue;
    }

    if (useStrict) {
      // Strict mode: only lines with explicit prefixes become tasks
      if (EXPLICIT_PREFIX.test(line)) {
        const taskText = stripPrefix(line);
        if (taskText.length > 0) {
          current.tasks.push({ text: taskText, required: isRequired(line) });
        }
      }
    } else {
      // Permissive mode: every usable non-header line becomes a task
      if (isUsableLine(line, headerSeen)) {
        const taskText = stripPrefix(line); // strips prefix if present, else returns as-is
        if (taskText.length > 0) {
          current.tasks.push({ text: taskText, required: isRequired(line) });
        }
      }
    }
  }

  // Flush last section
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

      const charCount = parsed.text.length;
      const lineCount = parsed.text.split("\n").length;
      req.log.info({ charCount, lineCount, pages: parsed.numpages }, "pdf text extracted");

      const result = parsePdfText(parsed.text);
      const taskCount = result.sections.reduce((n, s) => n + s.tasks.length, 0);
      req.log.info(
        { sections: result.sections.length, tasks: taskCount },
        "pdf parsed",
      );
      res.json(result);
    } finally {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
    }
  },
);

export default router;
