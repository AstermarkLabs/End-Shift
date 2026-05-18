import * as FileSystem from "expo-file-system";
import PdfThumbnail from "react-native-pdf-thumbnail";
import TextRecognition from "@react-native-ml-kit/text-recognition";

const MIN_TEXT_CHARS = 80;

export type ExtractionMethod = "text" | "ocr";

export interface ExtractionProgress {
  stage: "reading" | "extracting" | "ocr_render" | "ocr_recognize";
  page?: number;
  total?: number;
}

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
  pages: number;
}

export async function extractTextFromPdf(
  fileUri: string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<ExtractionResult> {
  onProgress?.({ stage: "reading" });

  const textResult = await tryNativeTextExtraction(fileUri, onProgress);
  if (textResult !== null && textResult.text.trim().length >= MIN_TEXT_CHARS) {
    return textResult;
  }

  return await extractWithOcr(fileUri, onProgress);
}

// ─── Pure-JS PDF text extraction ─────────────────────────────────────────────
// Works for uncompressed text streams (digital/typed PDFs).
// Compressed streams (FlateDecode) return empty → OCR fallback kicks in.

async function tryNativeTextExtraction(
  fileUri: string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<ExtractionResult | null> {
  try {
    onProgress?.({ stage: "extracting" });

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: "base64" as any,
    });

    const bytes = base64ToUint8Array(base64);
    const text = extractPdfText(bytes);

    // Count pages from PDF xref header
    const pages = countPdfPages(bytes);

    return { text, method: "text", pages };
  } catch {
    return null;
  }
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function extractPdfText(bytes: Uint8Array): string {
  // Decode as latin-1 to preserve byte values
  const raw = new TextDecoder("latin1").decode(bytes);

  const lines: string[] = [];

  // Extract text blocks between BT (begin text) and ET (end text) operators
  const btEt = /BT\b([\s\S]*?)\bET\b/g;
  let m: RegExpExecArray | null;

  while ((m = btEt.exec(raw)) !== null) {
    const block = m[1];
    const blockLines: string[] = [];

    // Simple text show: (string) Tj
    const tjRe = /\(([^)\\]|\\[\s\S])*?\)\s*(?:Tj|'|")/g;
    let tm: RegExpExecArray | null;
    while ((tm = tjRe.exec(block)) !== null) {
      const s = tm[0];
      const inner = s.slice(1, s.lastIndexOf(")"));
      const decoded = decodePdfLiteral(inner).trim();
      if (decoded) blockLines.push(decoded);
    }

    // Array text show: [(str1)(str2)…] TJ
    const tjArrayRe = /\[([\s\S]*?)\]\s*TJ/g;
    while ((tm = tjArrayRe.exec(block)) !== null) {
      const parts = tm[1].match(/\((?:[^)\\]|\\[\s\S])*?\)/g) ?? [];
      const decoded = parts
        .map((p) => decodePdfLiteral(p.slice(1, -1)))
        .join("")
        .trim();
      if (decoded) blockLines.push(decoded);
    }

    if (blockLines.length > 0) {
      lines.push(blockLines.join(" "));
    }
  }

  return lines.join("\n");
}

function decodePdfLiteral(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}

function countPdfPages(bytes: Uint8Array): number {
  const raw = new TextDecoder("latin1").decode(bytes);
  const m = raw.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

// ─── OCR fallback ─────────────────────────────────────────────────────────────

async function extractWithOcr(
  fileUri: string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const filePath = fileUri.startsWith("file://") ? fileUri.slice(7) : fileUri;

  onProgress?.({ stage: "ocr_render" });
  const pages = await PdfThumbnail.generateAllPages(filePath, 100);

  const pageTexts: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    onProgress?.({ stage: "ocr_recognize", page: i + 1, total: pages.length });
    const result = await TextRecognition.recognize(pages[i].uri);
    if (result.text) pageTexts.push(result.text);
  }

  return {
    text: pageTexts.join("\n\n"),
    method: "ocr",
    pages: pages.length,
  };
}
