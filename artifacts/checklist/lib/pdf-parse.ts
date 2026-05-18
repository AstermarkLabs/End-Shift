export interface ParsedTask {
  id: string;
  text: string;
  required: boolean;
}

export interface ParsedSection {
  id: string;
  title: string;
  tasks: ParsedTask[];
}

export interface ParsedChecklist {
  sections: ParsedSection[];
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Lines that are very likely section headers
const EXPLICIT_SECTION_PATTERNS: RegExp[] = [
  /^#{1,3}\s+(.+)/, // ## Heading
  /^(\d+)\.\s+([A-Z][A-Z &/\-]{3,})$/, // 1. SECTION NAME
  /^(SECTION|PART|PHASE|AREA|ZONE|CATEGORY|GROUP)\s+[\dA-Z:]/i,
  /^─{3,}(.+?)─{3,}/, // ─── Title ───
  /^={3,}(.+?)={3,}/, // === Title ===
  /^-{3,}(.+?)-{3,}/, // --- Title ---
];

// Patterns that always indicate a task item
const TASK_LINE_PATTERNS: Array<{ re: RegExp; capture: number }> = [
  { re: /^[-*•·]\s+(.+)/, capture: 1 },
  { re: /^\[[ xX✓]\]\s*(.+)/, capture: 1 },
  { re: /^☐\s*(.+)/, capture: 1 },
  { re: /^□\s*(.+)/, capture: 1 },
  { re: /^✓\s+(.+)/, capture: 1 },
  { re: /^(\d+)\.\s+(.+)/, capture: 2 },
  { re: /^\([a-zA-Z\d]\)\s+(.+)/, capture: 1 },
  { re: /^>\s*(.+)/, capture: 1 },
];

// Markers that hint a task is required
const REQUIRED_HINTS = [
  /\*{1,2}required\*{1,2}/i,
  /\(required\)/i,
  /\[required\]/i,
  /\bMUST\b/,
  /★/,
  /\*{1,2}[^*\n]{2,}\*{1,2}/, // *bold* or **bold**
];

function isRequired(raw: string): boolean {
  return REQUIRED_HINTS.some((p) => p.test(raw));
}

function cleanTaskText(raw: string): string {
  return raw
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/\(required\)/gi, "")
    .replace(/\[required\]/gi, "")
    .replace(/★/g, "")
    .trim();
}

function detectExplicitSection(line: string): string | null {
  for (const re of EXPLICIT_SECTION_PATTERNS) {
    const m = re.exec(line);
    if (m) {
      const title = (m[2] ?? m[1] ?? m[0]).trim().replace(/[:#]+$/, "").trim();
      if (title.length >= 3) return title;
    }
  }
  return null;
}

function detectTask(line: string): { text: string; required: boolean } | null {
  for (const { re, capture } of TASK_LINE_PATTERNS) {
    const m = re.exec(line);
    if (m) {
      const raw = m[capture] ?? "";
      if (raw.trim().length < 3) continue;
      return { text: cleanTaskText(raw), required: isRequired(line) };
    }
  }
  return null;
}

// Heuristic: is this line a section header (not explicitly marked)?
function isImplicitSectionHeader(line: string, nextLines: string[]): boolean {
  if (line.length > 80) return false;
  if (/[.?!,;]$/.test(line)) return false;
  // All caps or title-case, short
  const wordCount = line.trim().split(/\s+/).length;
  if (wordCount > 7) return false;
  if (/^[A-Z][A-Z\s\d&/\-]{2,}$/.test(line)) return true; // ALL CAPS
  // Line ends with colon
  if (/:\s*$/.test(line)) return true;
  // Short capitalized line followed by task-looking lines
  if (/^[A-Z]/.test(line) && wordCount <= 5) {
    const nextHasTasks = nextLines
      .slice(0, 3)
      .some((l) => detectTask(l) !== null);
    if (nextHasTasks) return true;
  }
  return false;
}

export function parsePdfText(rawText: string): ParsedChecklist {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3);

  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  const ensureSection = (title: string = "General") => {
    if (!currentSection) {
      currentSection = { id: uid(), title, tasks: [] };
      sections.push(currentSection);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Explicit section header?
    const explicitTitle = detectExplicitSection(line);
    if (explicitTitle) {
      currentSection = { id: uid(), title: explicitTitle, tasks: [] };
      sections.push(currentSection);
      continue;
    }

    // 2. Task item?
    const task = detectTask(line);
    if (task) {
      ensureSection();
      currentSection!.tasks.push({ id: uid(), text: task.text, required: task.required });
      continue;
    }

    // 3. Implicit section header?
    const nextLines = lines.slice(i + 1);
    if (isImplicitSectionHeader(line, nextLines)) {
      const title = line.replace(/:\s*$/, "").trim();
      currentSection = { id: uid(), title, tasks: [] };
      sections.push(currentSection);
      continue;
    }

    // 4. Plain line that looks like a task (fallback: if we're already in a section)
    if (currentSection && line.length >= 5 && line.length <= 200) {
      const text = cleanTaskText(line);
      if (text.length >= 5) {
        currentSection.tasks.push({ id: uid(), text, required: isRequired(line) });
      }
    }
  }

  return {
    sections: sections.filter((s) => s.tasks.length > 0),
  };
}
