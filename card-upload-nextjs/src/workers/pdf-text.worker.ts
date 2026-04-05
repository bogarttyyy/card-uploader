/// <reference lib="webworker" />

import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfTextFromBuffer as extractPdfTextFromArrayBuffer } from "@/lib/pdf-extraction/core";
import type {
  PdfExtractionWorkerRequest,
  PdfExtractionWorkerResponse,
} from "@/lib/pdf-extraction/types";

const workerScope = self as DedicatedWorkerGlobalScope;

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

workerScope.addEventListener("message", (event: MessageEvent<PdfExtractionWorkerRequest>) => {
  void handleExtraction(event.data);
});

async function handleExtraction(request: PdfExtractionWorkerRequest) {
  const response = await extractFromWorkerRequest(request);
  workerScope.postMessage(response satisfies PdfExtractionWorkerResponse);
}

async function extractFromWorkerRequest(
  request: PdfExtractionWorkerRequest,
): Promise<PdfExtractionWorkerResponse> {
  try {
    const result = await extractPdfTextFromArrayBuffer(request.buffer);

    return {
      id: request.id,
      ok: true,
      result,
    };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: {
        code: "extraction_failed",
        message:
          error instanceof Error
            ? error.message
            : "The PDF could not be processed in the browser.",
      },
    };
  }
}
