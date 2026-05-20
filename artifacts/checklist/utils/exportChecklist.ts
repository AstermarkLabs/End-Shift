import { Platform, Share } from "react-native";
import type { AppConfig, Task } from "@/context/ChecklistContext";

export type ExportFormat = "pdf" | "csv" | "docx";
export type HeaderPosition = "left" | "center" | "right";

/** On native, DOCX requires a filesystem we don't bundle — offer web only. */
export const DOCX_NATIVE_UNSUPPORTED = Platform.OS !== "web";

export interface ExportData {
  checklistName: string;
  sections: string[];
  tasks: Task[];
  completedAt?: string;
}

export interface ExportOptions {
  format: ExportFormat;
  includeCompletionStatus: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExportDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

// ─── HTML template for PDF ────────────────────────────────────────────────────

function buildHeaderCell(
  position: HeaderPosition,
  config: AppConfig,
  checklistName: string,
  dateStr: string,
): string {
  const parts: string[] = [];

  if (
    config.exportLogoEnabled &&
    config.exportLogoPosition === position &&
    config.customIconUri
  ) {
    parts.push(`<img src="${config.customIconUri}" class="logo" alt="logo" />`);
  }

  if (config.exportTitlePosition === position) {
    parts.push(`<div class="title">${escapeHtml(checklistName)}</div>`);
  }

  if (config.exportDateEnabled && config.exportDatePosition === position) {
    parts.push(`<div class="date">${escapeHtml(dateStr)}</div>`);
  }

  return parts.join("");
}

function buildPdfHtml(
  data: ExportData,
  config: AppConfig,
  options: ExportOptions,
): string {
  const { checklistName, sections, tasks } = data;
  const { primaryColor } = config;
  const { includeCompletionStatus } = options;
  const dateStr = formatExportDate(data.completedAt);

  const leftCell = buildHeaderCell("left", config, checklistName, dateStr);
  const centerCell = buildHeaderCell("center", config, checklistName, dateStr);
  const rightCell = buildHeaderCell("right", config, checklistName, dateStr);

  const sectionsHtml = sections
    .map((section) => {
      const sectionTasks = tasks.filter((t) => t.category === section);
      if (sectionTasks.length === 0) return "";
      const done = sectionTasks.filter((t) => t.completed).length;
      const progressText = includeCompletionStatus
        ? ` <span class="section-progress">${done}/${sectionTasks.length}</span>`
        : "";

      const tasksHtml = sectionTasks
        .map((task) => {
          const isDone = includeCompletionStatus && task.completed;
          return `
          <div class="task">
            <div class="checkbox ${isDone ? "done" : ""}"></div>
            <div class="task-body">
              <span class="task-text ${isDone ? "done" : ""}">${escapeHtml(task.text)}</span>
              ${!task.required ? `<span class="opt-badge">optional</span>` : ""}
            </div>
          </div>`;
        })
        .join("");

      return `
        <div class="section">
          <div class="section-header">${escapeHtml(section)}${progressText}</div>
          ${tasksHtml}
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 18mm 20mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.45; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2.5px solid ${primaryColor}; padding-bottom: 14px; }
    .header-table td { vertical-align: middle; padding-bottom: 10px; width: 33.33%; }
    .header-left { text-align: left; }
    .header-center { text-align: center; }
    .header-right { text-align: right; }
    .logo { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; display: inline-block; }
    .title { font-size: 20px; font-weight: 700; color: #1a1a1a; display: block; }
    .date { font-size: 11px; color: #666; margin-top: 4px; display: block; }
    .section { margin-top: 18px; page-break-inside: avoid; }
    .section-header {
      background: ${primaryColor}18; border-left: 4px solid ${primaryColor};
      padding: 5px 10px; font-size: 10.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.6px; color: #333;
      margin-bottom: 2px; display: flex; align-items: center; gap: 6px;
    }
    .section-progress { color: #888; font-weight: 400; }
    .task { display: flex; align-items: flex-start; padding: 6px 10px; border-bottom: 1px solid #f0f0f0; gap: 10px; page-break-inside: avoid; }
    .checkbox { width: 15px; height: 15px; border: 1.8px solid ${primaryColor}; border-radius: 50%; flex-shrink: 0; margin-top: 1px; display: inline-flex; align-items: center; justify-content: center; }
    .checkbox.done { background: ${primaryColor}; }
    .checkbox.done::after { content: "✓"; color: white; font-size: 9px; font-weight: 700; line-height: 1; }
    .task-body { flex: 1; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .task-text { font-size: 12.5px; color: #1a1a1a; }
    .task-text.done { text-decoration: line-through; color: #999; }
    .opt-badge { font-size: 9.5px; color: #aaa; border: 1px solid #ddd; border-radius: 3px; padding: 1px 4px; font-style: italic; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td class="header-left">${leftCell}</td>
      <td class="header-center">${centerCell}</td>
      <td class="header-right">${rightCell}</td>
    </tr>
  </table>
  ${sectionsHtml}
</body>
</html>`;
}

// ─── CSV builder ──────────────────────────────────────────────────────────────

function buildCsv(data: ExportData, options: ExportOptions): string {
  const { sections, tasks } = data;
  const { includeCompletionStatus } = options;

  const rows: string[][] = includeCompletionStatus
    ? [["Section", "Task", "Required", "Completed"]]
    : [["Section", "Task", "Required"]];

  for (const section of sections) {
    for (const task of tasks.filter((t) => t.category === section)) {
      const row = [section, task.text, task.required ? "Yes" : "No"];
      if (includeCompletionStatus) row.push(task.completed ? "Yes" : "No");
      rows.push(row);
    }
  }

  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

// ─── DOCX builder (web only) ─────────────────────────────────────────────────

async function buildDocxBlob(
  data: ExportData,
  config: AppConfig,
  options: ExportOptions,
): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle,
    ShadingType,
  } = await import("docx");

  const { checklistName, sections, tasks } = data;
  const { primaryColor } = config;
  const { includeCompletionStatus } = options;
  const dateStr = formatExportDate(data.completedAt);
  const hexColor = primaryColor.replace("#", "");

  function makeHeaderCell(
    position: HeaderPosition,
    align: (typeof AlignmentType)[keyof typeof AlignmentType],
  ) {
    const children: InstanceType<typeof Paragraph>[] = [];

    if (config.exportTitlePosition === position) {
      children.push(
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text: checklistName, bold: true, size: 36, color: hexColor }),
          ],
        }),
      );
    }

    if (config.exportDateEnabled && config.exportDatePosition === position) {
      children.push(
        new Paragraph({
          alignment: align,
          children: [new TextRun({ text: dateStr, size: 18, color: "666666" })],
        }),
      );
    }

    if (children.length === 0) children.push(new Paragraph({ children: [] }));

    return new TableCell({
      children,
      borders: {
        top: { style: BorderStyle.NONE, size: 0 },
        bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 },
        right: { style: BorderStyle.NONE, size: 0 },
      },
      width: { size: 33, type: WidthType.PERCENTAGE },
    });
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          makeHeaderCell("left", AlignmentType.LEFT),
          makeHeaderCell("center", AlignmentType.CENTER),
          makeHeaderCell("right", AlignmentType.RIGHT),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.NONE, size: 0 },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: hexColor },
      left: { style: BorderStyle.NONE, size: 0 },
      right: { style: BorderStyle.NONE, size: 0 },
    },
  });

  const bodyChildren: (
    | InstanceType<typeof Paragraph>
    | InstanceType<typeof Table>
  )[] = [headerTable, new Paragraph({ children: [] })];

  for (const section of sections) {
    const sectionTasks = tasks.filter((t) => t.category === section);
    if (sectionTasks.length === 0) continue;
    const done = sectionTasks.filter((t) => t.completed).length;
    const progressText = includeCompletionStatus
      ? ` (${done}/${sectionTasks.length})`
      : "";

    bodyChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.toUpperCase() + progressText,
            bold: true,
            size: 20,
            color: hexColor,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: hexColor + "18", fill: hexColor + "18" },
        spacing: { before: 240, after: 40 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: hexColor, space: 6 } },
      }),
    );

    for (const task of sectionTasks) {
      const isDone = includeCompletionStatus && task.completed;
      bodyChildren.push(
        new Paragraph({
          indent: { left: 200 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: `${isDone ? "☑" : "☐"}  `, color: isDone ? hexColor : "888888" }),
            new TextRun({ text: task.text, strike: isDone, color: isDone ? "999999" : "1a1a1a" }),
            ...(!task.required
              ? [new TextRun({ text: "  (optional)", italics: true, color: "aaaaaa", size: 18 })]
              : []),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children: bodyChildren as InstanceType<typeof Paragraph>[] }],
  });

  return Packer.toBlob(doc);
}

// ─── Platform-specific delivery ───────────────────────────────────────────────

async function webDownload(
  content: string | Blob,
  filename: string,
  mimeType: string,
): Promise<void> {
  const blob =
    typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Public export function ───────────────────────────────────────────────────

export async function exportChecklist(
  data: ExportData,
  config: AppConfig,
  options: ExportOptions,
): Promise<void> {
  const safeFilename = sanitizeFilename(data.checklistName);
  const isWeb = Platform.OS === "web";

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (options.format === "pdf") {
    const html = buildPdfHtml(data, config, options);

    if (isWeb) {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }
    } else {
      const Print = await import("expo-print");
      const Sharing = await import("expo-sharing");
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    }
    return;
  }

  // ── CSV ──────────────────────────────────────────────────────────────────
  if (options.format === "csv") {
    const csv = buildCsv(data, options);
    if (isWeb) {
      await webDownload(csv, `${safeFilename}.csv`, "text/csv");
    } else {
      await Share.share({ message: csv, title: `${data.checklistName}.csv` });
    }
    return;
  }

  // ── DOCX (web only) ──────────────────────────────────────────────────────
  if (options.format === "docx") {
    const blob = await buildDocxBlob(data, config, options);
    await webDownload(
      blob,
      `${safeFilename}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  }
}
