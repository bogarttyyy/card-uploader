"use client";

import { useId, useRef, useState } from "react";
import styles from "./upload-shell.module.css";
import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";
import { PdfExtractionError, extractPdfText } from "@/lib/pdf-extraction";
import {
  computeBalance,
  parseStatementFromExtraction,
  type ParsedStatementResult,
} from "@/lib/statement";

const ACCEPTED_FILE_TYPES = getAcceptedFileTypes();
type ExtractionState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      pageCount: number;
      characterCount: number;
      preview: string;
      parsed: ParsedStatementResult;
    }
  | { status: "error"; message: string };

export function UploadShell() {
  const inputId = useId();
  const requestIdRef = useRef(0);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: "idle" });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      setExtractionState({ status: "idle" });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSelectedFileName(file.name);
    setExtractionState({ status: "loading" });

    try {
      const result = await extractPdfText(file);
      if (requestIdRef.current !== requestId) {
        return;
      }

      const parsed = parseStatementFromExtraction(result);
      const preview = result.pageTexts.find((pageText) => pageText.trim()) ?? "";
      setExtractionState({
        status: "success",
        pageCount: result.pageTexts.length,
        characterCount: result.fullText.length,
        preview: preview.slice(0, 220),
        parsed,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const message =
        error instanceof PdfExtractionError
          ? error.message
          : "The PDF could not be processed in the browser.";

      setExtractionState({
        status: "error",
        message,
      });
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelLabel}>Upload</p>
          <h2>Load a Macquarie Bank credit card statement PDF</h2>
          <p className={styles.panelCopy}>
            This milestone extracts raw text in the browser worker and reports whether the upload
            succeeded. Full transaction parsing and CSV export still come later.
          </p>
        </div>

        <label className={styles.dropzone} htmlFor={inputId}>
          <span className={styles.dropzoneTitle}>Choose a PDF statement</span>
          <span className={styles.dropzoneCopy}>Accepted type: PDF</span>
          <input
            id={inputId}
            name="statement"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className={styles.input}
            aria-describedby={`${inputId}-hint`}
            onChange={handleFileChange}
          />
        </label>

        <p className={styles.fileHint} id={`${inputId}-hint`}>
          {selectedFileName
            ? isPdfFileName(selectedFileName)
              ? `Selected file: ${selectedFileName}`
              : `Selected file: ${selectedFileName} (unsupported file)`
            : "No statement loaded yet."}
        </p>
      </div>

      <div className={styles.resultsHeader}>
        <div>
          <p className={styles.panelLabel}>Results</p>
          <h2>{getResultsTitle(extractionState)}</h2>
        </div>
        <p className={styles.resultsCopy}>{getResultsCopy(extractionState)}</p>
      </div>

      {extractionState.status === "loading" ? (
        <div className={styles.statusCard} role="status">
          <p className={styles.statusTitle}>Extracting text from PDF</p>
          <p className={styles.statusCopy}>
            Keeping work inside a browser worker so the main thread stays responsive.
          </p>
        </div>
      ) : null}

      {extractionState.status === "error" ? (
        <div className={styles.errorCard} role="alert">
          <p className={styles.statusTitle}>Extraction failed</p>
          <p className={styles.statusCopy}>{extractionState.message}</p>
        </div>
      ) : null}

      {extractionState.status === "success" ? (
        <div className={styles.summaryCard} role="status">
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Pages</span>
              <strong>{extractionState.pageCount}</strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Characters</span>
              <strong>{extractionState.characterCount.toLocaleString()}</strong>
            </div>
          </div>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Due date</span>
              <strong className={styles.metricValueSmall}>
                {extractionState.parsed.metadata.minimumDueDate ?? "-"}
              </strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Closing balance</span>
              <strong className={styles.metricValueSmall}>
                {formatCurrency(extractionState.parsed.metadata.closingBalance)}
              </strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Computed balance</span>
              <strong className={styles.metricValueSmall}>
                {formatCurrency(
                  computeBalance(
                    extractionState.parsed.transactions,
                    extractionState.parsed.metadata.cardNumbers,
                  ),
                )}
              </strong>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Cards</span>
              <strong className={styles.metricValueSmall}>
                {extractionState.parsed.metadata.cardNumbers.join(", ") || "-"}
              </strong>
            </div>
          </div>
          <div className={styles.previewBlock}>
            <p className={styles.previewLabel}>Parsed summary</p>
            <pre className={styles.previewText}>
              {`Transactions: ${extractionState.parsed.transactions.length}
Card totals: ${extractionState.parsed.cardSummary
                .map((row) => `${row.cardNumber} ${formatCurrency(row.netTotal)}`)
                .join(" | ")}`}
            </pre>
            <p className={styles.previewLabel}>First extracted text preview</p>
            <pre className={styles.previewText}>
              {extractionState.preview || "No text was extracted from the first available page."}
            </pre>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getResultsTitle(extractionState: ExtractionState): string {
  switch (extractionState.status) {
    case "idle":
      return "Waiting for parsed statement data";
    case "loading":
      return "Extracting raw PDF text";
    case "success":
      return "Parsed statement ready";
    case "error":
      return "PDF extraction needs attention";
  }
}

function getResultsCopy(extractionState: ExtractionState): string {
  switch (extractionState.status) {
    case "idle":
      return "Summary, reconciliation, and CSV download panels remain hidden until parsing is implemented.";
    case "loading":
      return "The upload is being processed in-browser. Parser rules are still not applied at this stage.";
    case "success":
      return "The app can now extract page text and parse supported statement fixtures into card-level totals.";
    case "error":
      return "The upload reached the extraction layer, but the browser could not return usable PDF text.";
  }
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
