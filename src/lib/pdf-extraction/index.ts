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

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export type ExtractPdfTextOptions = {
  signal?: AbortSignal;
};

export async function extractPdfText(
  file: File,
  { signal }: ExtractPdfTextOptions = {},
): Promise<PdfTextExtractionResult> {
  validatePdfFile(file);
  throwIfAborted(signal);

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new PdfExtractionError(
      "extraction_failed",
      "The selected file could not be read in the browser.",
    );
  }

  throwIfAborted(signal);
  if (!hasPdfSignature(buffer)) {
    throw new PdfExtractionError(
      "invalid_pdf",
      "The selected file does not contain a valid PDF signature.",
    );
  }

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
      signal?.removeEventListener("abort", handleAbort);
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

    const handleAbort = () => {
      cleanup();
      reject(createAbortedError());
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    signal?.addEventListener("abort", handleAbort, { once: true });

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    const request: PdfExtractionWorkerRequest = {
      id,
      fileName: file.name,
      mimeType: file.type,
      buffer,
    };
    worker.postMessage(request, [buffer]);
  });
}

export function validatePdfFile(file: File): void {
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfExtractionError(
      "file_too_large",
      "Please choose a PDF statement no larger than 10 MiB.",
    );
  }

  const isPdfMimeType = file.type === "application/pdf";
  if (!isPdfMimeType && !isPdfFileName(file.name)) {
    throw new PdfExtractionError(
      "unsupported_file",
      "Please upload a PDF statement. Other file types are not supported.",
    );
  }
}

function hasPdfSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, PDF_SIGNATURE.length));
  return PDF_SIGNATURE.every((value, index) => bytes[index] === value);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortedError();
  }
}

function createAbortedError(): PdfExtractionError {
  return new PdfExtractionError("aborted", "PDF extraction was cancelled.");
}
