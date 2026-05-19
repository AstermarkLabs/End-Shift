import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";
import mammoth from "mammoth";
import { blockIfMustChangePassword, requireAuth, requireRight } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth, blockIfMustChangePassword);

// ── Multer setup ──────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => {
      cb(null, `endshift-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".docx");
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Only Word documents (.docx) are accepted"));
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

// ── Markers ───────────────────────────────────────────────────────────────────

const TASK_PREFIX = /^(?:[-*•·→✓☐☑✗✘▸▹◦]|\[[\s xX]?\]\s*|\d{1,3}[.)]\s+|\([a-zA-Z0-9]\)\s+)/;
const REQUIRED_SUFFIX = /\s*\*\s*$|\s*\(\s*required\s*\)\s*$/i;
const REQUIRED_WORD = /\b(?:required|mandatory|must)\b/i;

function isRequired(text: string): boolean {
  return REQUIRED_WORD.test(text) || REQUIRED_SUFFIX.test(text);
}

function stripTaskPrefix(text: string): string {
  return text
    .replace(TASK_PREFIX, "")
    .replace(REQUIRED_SUFFIX, "")
    .trim();
}

// ── HTML parser ───────────────────────────────────────────────────────────────

/**
 * Parse mammoth's HTML output into checklist sections and tasks.
 *
 * Mapping rules:
 *   <h1>, <h2>     → new section title
 *   <h3>           → current subsection label
 *   <li>           → task (always captured)
 *   <p>            → task if it starts/ends with a recognised task marker,
 *                    or if we are already inside a section (permissive)
 */
function parseDocxHtml(html: string): { sections: ImportSection[] } {
  const sections: ImportSection[] = [];
  let current: ImportSection = { title: "General Tasks", tasks: [] };
  let currentSubsection: string | null = null;

  // Unwrap <ul> and <ol> containers so their <li> children are top-level
  // block elements that the regex below can match individually.  Without this
  // step the outer <ul>/<ol> would be consumed by the regex first, and the
  // inner <li> nodes would never be visited.
  const flattened = html.replace(/<\/?(ul|ol)[^>]*>/gi, "");

  // Pre-scan: does this document have any section headings (h1/h2)?
  // If not, we enter permissive mode immediately so that every non-empty
  // paragraph is treated as a task under "General Tasks".
  const hasHeadings = /<h[12][^>]*>/i.test(flattened);
  let inSection = !hasHeadings; // permissive from the start when no headings found

  // Match top-level block elements in document order
  const blockRe = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRe.exec(flattened)) !== null) {
    const tag = match[1].toLowerCase();
    // Strip any inner inline tags and decode basic HTML entities
    const rawText = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();

    if (!rawText) continue;

    if (tag === "h1" || tag === "h2") {
      // Flush and start a new section
      if (inSection || current.tasks.length > 0) {
        sections.push(current);
      }
      current = { title: rawText, tasks: [] };
      currentSubsection = null;
      inSection = true;
      continue;
    }

    if (tag === "h3") {
      currentSubsection = rawText || null;
      continue;
    }

    if (tag === "h4" || tag === "h5" || tag === "h6") {
      // Treat deeper headings as subsections
      currentSubsection = rawText || null;
      continue;
    }

    if (tag === "li") {
      const text = stripTaskPrefix(rawText);
      if (text.length > 0) {
        current.tasks.push({
          text,
          required: isRequired(rawText),
          subsection: currentSubsection,
        });
      }
      continue;
    }

    if (tag === "p") {
      // Capture paragraphs that carry an explicit task marker, or any
      // paragraph once we are inside a named section (or in permissive mode
      // because the document has no section headings at all).
      const hasMarker = TASK_PREFIX.test(rawText) || REQUIRED_SUFFIX.test(rawText);
      if (hasMarker || inSection) {
        const text = stripTaskPrefix(rawText);
        if (text.length >= 3) {
          current.tasks.push({
            text,
            required: isRequired(rawText),
            subsection: currentSubsection,
          });
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
  "/checklists/import/docx",
  requireRight("create_checklists"),
  upload.single("file"),
  handleMulterError,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No Word document uploaded" });
      return;
    }

    const inputPath = req.file.path;
    try {
      const buffer = await fs.readFile(inputPath);
      const { value: html, messages } = await mammoth.convertToHtml({ buffer });

      for (const msg of messages) {
        if (msg.type === "warning") {
          req.log.warn({ msg: msg.message }, "mammoth warning");
        }
      }

      if (!html || html.trim().length === 0) {
        res.status(422).json({
          error: "Could not extract content from this Word document. Make sure it contains text.",
        });
        return;
      }

      const result = parseDocxHtml(html);
      const taskCount = result.sections.reduce((n, s) => n + s.tasks.length, 0);
      req.log.info({ sections: result.sections.length, tasks: taskCount }, "docx parsed");

      res.json(result);
    } finally {
      await fs.unlink(inputPath).catch(() => {});
    }
  },
);

export default router;
