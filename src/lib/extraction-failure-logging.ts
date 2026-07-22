import type { PdfExtractionErrorCode } from "@/lib/pdf-extraction";

export type ExtractionFailureStage = "extraction" | "parsing";
export type ExtractionFailureCode = PdfExtractionErrorCode | "parsing_failed";

type ReportExtractionFailureInput = {
  stage: ExtractionFailureStage;
  code: ExtractionFailureCode;
};

export function reportExtractionFailure({
  stage,
  code,
}: ReportExtractionFailureInput): void {
  void fetch("/api/extraction-failures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ stage, code }),
    keepalive: true,
  }).catch(() => {
    // Reporting should never affect the upload workflow.
  });
}
