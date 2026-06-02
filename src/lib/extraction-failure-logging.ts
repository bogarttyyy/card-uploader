import type { PdfExtractionErrorCode } from "@/lib/pdf-extraction";

export type ExtractionFailureStage = "extraction" | "parsing";

type ReportExtractionFailureInput = {
  stage: ExtractionFailureStage;
  file: File;
  errorCode?: PdfExtractionErrorCode;
  errorMessage: string;
};

export function reportExtractionFailure({
  stage,
  file,
  errorCode,
  errorMessage,
}: ReportExtractionFailureInput): void {
  const payload = {
    stage,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    fileLastModified: file.lastModified,
    errorCode,
    errorMessage,
    userAgent: globalThis.navigator?.userAgent,
  };

  void fetch("/api/extraction-failures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Reporting should never affect the upload workflow.
  });
}
