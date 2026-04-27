export type PdfTextExtractionResult = {
  pageTexts: string[];
  fullText: string;
};

export type PdfExtractionErrorCode =
  | "unsupported_file"
  | "worker_unavailable"
  | "extraction_failed";

export class PdfExtractionError extends Error {
  code: PdfExtractionErrorCode;

  constructor(code: PdfExtractionErrorCode, message: string) {
    super(message);
    this.name = "PdfExtractionError";
    this.code = code;
  }
}

export type PdfExtractionWorkerRequest = {
  id: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
};

export type PdfExtractionWorkerSuccess = {
  id: string;
  ok: true;
  result: PdfTextExtractionResult;
};

export type PdfExtractionWorkerFailure = {
  id: string;
  ok: false;
  error: {
    code: PdfExtractionErrorCode;
    message: string;
  };
};

export type PdfExtractionWorkerResponse =
  | PdfExtractionWorkerSuccess
  | PdfExtractionWorkerFailure;
