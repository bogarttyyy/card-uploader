import { isPdfFileName } from "@/lib/files";
import {
  PdfExtractionError,
  type PdfExtractionWorkerRequest,
  type PdfExtractionWorkerResponse,
  type PdfTextExtractionResult,
} from "@/lib/pdf-extraction/types";

export {
  PdfExtractionError,
  type PdfExtractionErrorCode,
  type PdfExtractionWorkerFailure,
  type PdfExtractionWorkerRequest,
  type PdfExtractionWorkerResponse,
  type PdfExtractionWorkerSuccess,
  type PdfTextExtractionResult,
} from "@/lib/pdf-extraction/types";

export async function extractPdfText(file: File): Promise<PdfTextExtractionResult> {
  validatePdfFile(file);

  if (typeof Worker === "undefined") {
    throw new PdfExtractionError(
      "worker_unavailable",
      "This browser does not support Web Workers for PDF extraction.",
    );
  }

  const worker = new Worker(new URL("../../workers/pdf-text.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<PdfTextExtractionResult>((resolve, reject) => {
    const id = globalThis.crypto?.randomUUID?.() ?? `extract-${Date.now()}`;

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
    };

    const handleMessage = (event: MessageEvent<PdfExtractionWorkerResponse>) => {
      const message = event.data;
      if (!message || message.id !== id) {
        return;
      }

      cleanup();

      if (message.ok) {
        resolve(message.result);
        return;
      }

      reject(new PdfExtractionError(message.error.code, message.error.message));
    };

    const handleError = () => {
      cleanup();
      reject(
        new PdfExtractionError(
          "extraction_failed",
          "The PDF extraction worker failed before it could return any text.",
        ),
      );
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    void file.arrayBuffer().then(
      (buffer) => {
        const request: PdfExtractionWorkerRequest = {
          id,
          fileName: file.name,
          mimeType: file.type,
          buffer,
        };
        worker.postMessage(request, [buffer]);
      },
      () => {
        cleanup();
        reject(
          new PdfExtractionError(
            "extraction_failed",
            "The selected file could not be read in the browser.",
          ),
        );
      },
    );
  });
}

export function validatePdfFile(file: File): void {
  const isPdfMimeType = file.type === "application/pdf";
  if (!isPdfMimeType && !isPdfFileName(file.name)) {
    throw new PdfExtractionError(
      "unsupported_file",
      "Please upload a PDF statement. Other file types are not supported.",
    );
  }
}
