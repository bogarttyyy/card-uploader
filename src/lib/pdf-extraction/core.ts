import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextExtractionResult } from "@/lib/pdf-extraction/types";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

type LineItem = {
  text: string;
  x: number;
  y: number;
};

const LINE_Y_TOLERANCE = 2;

export async function extractPdfTextFromBuffer(
  buffer: ArrayBuffer | Uint8Array,
): Promise<PdfTextExtractionResult> {
  const documentOptions = {
    data: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof getDocument>[0] & { disableWorker?: boolean };

  if (typeof window === "undefined") {
    documentOptions.disableWorker = true;
  }

  const loadingTask = getDocument(documentOptions);
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pageTexts.push(normalizePageText(textContent.items as PdfTextItem[]));
  }

  return {
    pageTexts,
    fullText: pageTexts.join("\n"),
  };
}

export function normalizePageText(items: PdfTextItem[]): string {
  const groupedLines: LineItem[][] = [];

  for (const item of items) {
    const text = item.str?.trim();
    if (!text) {
      continue;
    }

    const x = item.transform?.[4];
    const y = item.transform?.[5];
    if (typeof x !== "number" || typeof y !== "number") {
      continue;
    }

    const existingLine = groupedLines.find(
      (line) => Math.abs(line[0]?.y ?? Number.POSITIVE_INFINITY - y) <= LINE_Y_TOLERANCE,
    );

    if (existingLine) {
      existingLine.push({ text, x, y });
    } else {
      groupedLines.push([{ text, x, y }]);
    }
  }

  const lines = groupedLines
    .sort((left, right) => right[0].y - left[0].y)
    .map((line) =>
      line
        .sort((left, right) => left.x - right.x)
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);

  return lines.join("\n");
}
