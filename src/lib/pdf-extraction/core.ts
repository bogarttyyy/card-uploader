import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfTextExtractionResult } from "@/lib/pdf-extraction/types";

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

type PdfTextContentChunk = {
  items: PdfTextItem[];
};

type PdfTextContentStream = {
  getReader: () => ReadableStreamDefaultReader<PdfTextContentChunk>;
};

type PdfTextPage = {
  streamTextContent: () => PdfTextContentStream;
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

  try {
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textItems = await readPageTextItems(page as PdfTextPage);
      pageTexts.push(normalizePageText(textItems));
    }

    return {
      pageTexts,
      fullText: pageTexts.join("\n"),
    };
  } finally {
    await pdf.destroy();
  }
}

async function readPageTextItems(page: PdfTextPage): Promise<PdfTextItem[]> {
  const reader = page.streamTextContent().getReader();
  const items: PdfTextItem[] = [];

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        return items;
      }

      if (value) {
        items.push(...value.items);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function normalizePageText(items: PdfTextItem[]): string {
  const positionedItems: LineItem[] = items.flatMap((item) => {
    const text = item.str?.trim();
    const x = item.transform?.[4];
    const y = item.transform?.[5];

    return text && typeof x === "number" && typeof y === "number"
      ? [{ text, x, y }]
      : [];
  });
  positionedItems.sort((left, right) => right.y - left.y || left.x - right.x);

  const groupedLines: LineItem[][] = [];
  for (const item of positionedItems) {
    const currentLine = groupedLines.at(-1);
    const lineY = currentLine?.[0]?.y;

    if (currentLine && lineY !== undefined && Math.abs(lineY - item.y) <= LINE_Y_TOLERANCE) {
      currentLine.push(item);
    } else {
      groupedLines.push([item]);
    }
  }

  const lines = groupedLines
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
