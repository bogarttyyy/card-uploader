"use client";

import { RefreshCw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { StatementResults } from "@/components/statement-results";
import { ThemeToggle } from "@/components/theme-toggle";
import { UploadPanel } from "@/components/upload-panel";
import { reportExtractionFailure } from "@/lib/extraction-failure-logging";
import { PdfExtractionError, extractPdfText } from "@/lib/pdf-extraction";
import {
  parseStatementFromExtraction,
  type ParsedStatementResult,
} from "@/lib/statement";

export type ExtractionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; parsed: ParsedStatementResult }
  | { status: "error"; title: string; message: string; category: string };

export function UploadShell() {
  const inputId = useId();
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: "idle" });
  const [selectedCard, setSelectedCard] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  async function processFile(file: File) {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSelectedFileName(file.name);
    setExtractionState({ status: "loading" });
    setSelectedCard("");

    try {
      const result = await extractPdfText(file, { signal: abortController.signal });
      if (requestIdRef.current !== requestId) {
        return;
      }

      const parsed = parseStatementFromExtraction(result);
      setExtractionState({ status: "success", parsed });
      setSelectedCard(parsed.metadata.cardNumbers[0] ?? "");
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const isPdfExtractionError = error instanceof PdfExtractionError;
      if (isPdfExtractionError && error.code === "aborted") {
        return;
      }

      const failureStage = isPdfExtractionError ? "extraction" : "parsing";
      const failureCode = isPdfExtractionError ? error.code : "parsing_failed";
      const extractionError = isPdfExtractionError
        ? { title: "Extraction failed", message: error.message }
        : {
            title: "Parsing failed",
            message:
              "The PDF text was extracted, but the statement could not be parsed into the supported format.",
          };

      if (!isPdfExtractionError || error.code !== "unsupported_file") {
        reportExtractionFailure({ stage: failureStage, code: failureCode });
      }

      setExtractionState({
        status: "error",
        ...extractionError,
        category: `${failureStage}/${failureCode}`,
      });
      setSelectedCard("");
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      resetWorkflow();
      return;
    }

    void processFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];

    if (file) {
      void processFile(file);
    }
  }

  function resetWorkflow() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
    setSelectedFileName(null);
    setExtractionState({ status: "idle" });
    setSelectedCard("");
    setIsDragging(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const isProcessing = extractionState.status === "loading";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Pampi Card
            </h1>
            <p className="max-w-2xl text-slate-600 dark:text-slate-400">
              Convert Macquarie credit card statements to CSV—privately in your browser.
            </p>
          </div>
          <div className="flex flex-row-reverse items-center justify-between gap-3 md:flex-row">
            <ThemeToggle />
            {extractionState.status !== "idle" ? (
              <button
                type="button"
                onClick={resetWorkflow}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950"
              >
                {isProcessing ? <X aria-hidden="true" className="h-4 w-4" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
                {isProcessing ? "Cancel processing" : "Upload new statement"}
              </button>
            ) : null}
          </div>
        </header>

        {extractionState.status === "success" ? (
          <StatementResults
            parsed={extractionState.parsed}
            selectedCard={selectedCard}
            onSelectedCardChange={setSelectedCard}
            onReset={resetWorkflow}
          />
        ) : (
          <UploadPanel
            inputId={inputId}
            inputRef={inputRef}
            isDragging={isDragging}
            isProcessing={isProcessing}
            selectedFileName={selectedFileName}
            extractionState={extractionState}
            onFileChange={handleFileChange}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          />
        )}
      </div>
    </main>
  );
}
