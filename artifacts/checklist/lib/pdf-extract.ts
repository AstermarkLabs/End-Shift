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

  const textResult = await tryPdfJsExtraction(fileUri, onProgress);
  if (textResult !== null && textResult.text.trim().length >= MIN_TEXT_CHARS) {
    return textResult;
  }

  return await extractWithOcr(fileUri, onProgress);
}

async function tryPdfJsExtraction(
  fileUri: string,
  onProgress?: (p: ExtractionProgress) => void
): Promise<ExtractionResult | null> {
  try {
    const pdfjsLib: any = await import("pdfjs-dist");

    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }

    onProgress?.({ stage: "reading" });

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: "base64" as any,
    });

    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      data[i] = binary.charCodeAt(i);
    }

    onProgress?.({ stage: "extracting" });

    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableRange: true,
      disableStream: true,
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.({ stage: "extracting", page: pageNum, total: pdf.numPages });
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const lineMap = new Map<number, string[]>();

      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = Math.round((item as any).transform?.[5] ?? 0);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push(item.str);
      }

      const lines = [...lineMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, words]) => words.join(" "));

      pageTexts.push(lines.join("\n"));
    }

    return { text: pageTexts.join("\n\n"), method: "text", pages: pdf.numPages };
  } catch {
    return null;
  }
}

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
