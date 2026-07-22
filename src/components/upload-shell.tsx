"use client";

import {
  AlertCircle,
  Calendar,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  ReceiptText,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useId, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";
import { reportExtractionFailure } from "@/lib/extraction-failure-logging";
import { PdfExtractionError, extractPdfText } from "@/lib/pdf-extraction";
import {
  buildCombinedCardCsvData,
  buildCsvData,
  computeBalance,
  computeCardTotal,
  getExcludedTransactionsForCard,
  getTransactionsForCard,
  parseStatementFromExtraction,
  transactionsToExportRows,
  type ParsedStatementResult,
} from "@/lib/statement";
import type { CardSummary, ReconciliationRow, Transaction } from "@/lib/statement";

const ACCEPTED_FILE_TYPES = getAcceptedFileTypes();
const FILE_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

type ExtractionState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "success";
      pageCount: number;
      characterCount: number;
      parsed: ParsedStatementResult;
      issues: string[];
    }
  | { status: "error"; title: string; message: string };

export function UploadShell() {
  const inputId = useId();
  const requestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: "idle" });
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  async function processFile(file: File) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSelectedFileName(file.name);
    setExtractionState({ status: "loading" });
    setSelectedCard("");

    try {
      const result = await extractPdfText(file);
      if (requestIdRef.current !== requestId) {
        return;
      }

      const parsed = parseStatementFromExtraction(result);
      setExtractionState({
        status: "success",
        pageCount: result.pageTexts.length,
        characterCount: result.fullText.length,
        parsed,
        issues: getStatementIssues(parsed),
      });
      setSelectedCard(parsed.metadata.cardNumbers[0] ?? "");
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const isPdfExtractionError = error instanceof PdfExtractionError;
      const extractionError = isPdfExtractionError
        ? {
            title: "Extraction failed",
            message: error.message,
          }
        : {
            title: "Parsing failed",
            message:
              "The PDF text was extracted, but the statement could not be parsed into the supported format.",
          };

      if (!isPdfExtractionError || error.code !== "unsupported_file") {
        reportExtractionFailure({
          stage: isPdfExtractionError ? "extraction" : "parsing",
          file,
          errorCode: isPdfExtractionError ? error.code : undefined,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      setExtractionState({
        status: "error",
        ...extractionError,
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
    requestIdRef.current += 1;
    setSelectedFileName(null);
    setExtractionState({ status: "idle" });
    setSelectedCard("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Credit Card Bill Manager
            </h1>
            <p className="max-w-2xl text-slate-600 dark:text-slate-400">
              Upload a PDF statement, review parsed totals, reconcile balances, and export
              browser-generated CSV files without sending data to a backend service.
            </p>
          </div>
          <div className="flex flex-row-reverse items-center gap-3 justify-between">
            <ThemeToggle />
            {extractionState.status !== "idle" ? (
              <button
              type="button"
              onClick={resetWorkflow}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                <RefreshCw className="h-4 w-4" />
                Upload New Bill
              </button>
            ) : null}
          </div>
        </header>

        {extractionState.status === "success" ? (
          <SuccessfulStatementView
            extractionState={extractionState}
            selectedCard={selectedCard}
            onSelectedCardChange={setSelectedCard}
            onReset={resetWorkflow}
          />
        ) : (
          <UploadPanel
            inputId={inputId}
            inputRef={inputRef}
            isDragging={isDragging}
            isProcessing={extractionState.status === "loading"}
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

function UploadPanel({
  inputId,
  inputRef,
  isDragging,
  isProcessing,
  selectedFileName,
  extractionState,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  isProcessing: boolean;
  selectedFileName: string | null;
  extractionState: ExtractionState;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
}) {
  return (
    <section className="mx-auto max-w-2xl">
      <label
        htmlFor={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          "block cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all md:p-12",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500",
          isProcessing ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          id={inputId}
          name="statement"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          aria-label="Choose a PDF statement"
          aria-describedby={`${inputId}-hint`}
          onChange={onFileChange}
          className="sr-only"
        />

        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <>
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <div role="status">
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                  Extracting text from PDF
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Keeping work inside a browser worker so the main thread stays responsive.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Upload className="h-10 w-10 text-blue-600 dark:text-blue-400" />
              </div>

              <div>
                <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
                  Upload Your Credit Card Bill
                </h2>
                <p className="mb-4 text-slate-600 dark:text-slate-400">
                  Drag and drop your PDF statement here, or click to browse.
                </p>
              </div>

              <span className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600">
                Select File
              </span>

              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <FileText className="h-4 w-4" />
                <span>Supports PDF statements</span>
              </div>
            </>
          )}
        </div>
      </label>

      <p id={`${inputId}-hint`} className="mt-4 min-h-6 text-sm text-slate-600 dark:text-slate-400">
        {selectedFileName
          ? isPdfFileName(selectedFileName)
            ? `Selected file: ${selectedFileName}`
            : `Selected file: ${selectedFileName} (unsupported file)`
          : "No statement loaded yet."}
      </p>

      {extractionState.status === "error" ? (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="mb-1 font-semibold">{extractionState.title}</p>
            <p className="text-red-700 dark:text-red-300">{extractionState.message}</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="mb-1 font-semibold">Private browser workflow</p>
            <p className="text-blue-700 dark:text-blue-300">
              The current implementation accepts PDF statements only and processes them locally.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SuccessfulStatementView({
  extractionState,
  selectedCard,
  onSelectedCardChange,
  onReset,
}: {
  extractionState: ExtractionState & { status: "success" };
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
  onReset: () => void;
}) {
  const { parsed } = extractionState;
  const isCompleteStatement = extractionState.issues.length === 0;
  const combinedTransactions = parsed.transactions.filter((transaction) => !transaction.isPayment);
  const combinedCsvHref = buildCsvHref(
    buildCombinedCardCsvData(
      transactionsToExportRows(combinedTransactions, parsed.metadata),
      parsed.metadata.cardNumbers,
    ),
  );
  const hasReconciliationMismatch = parsed.reconciliationRows.some(
    (row) => row.delta !== null && row.delta !== 0,
  );

  return (
    <div className="space-y-6" role="status">
      <BillSummary
        parsed={parsed}
        pageCount={extractionState.pageCount}
        characterCount={extractionState.characterCount}
        exportableRows={combinedTransactions.length}
        isCompleteStatement={isCompleteStatement}
        combinedCsvHref={combinedCsvHref}
      />

      {extractionState.issues.length > 0 ? (
        <IssueCard title="This statement is not ready for export yet." issues={extractionState.issues} />
      ) : null}

      {hasReconciliationMismatch ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        >
          Parsed totals do not fully reconcile with the statement summary. Review the
          reconciliation section before exporting.
        </div>
      ) : null}

      {isCompleteStatement ? (
        <>
          <CardList cardSummary={parsed.cardSummary} parsed={parsed} />
          <ReconciliationPanel rows={parsed.reconciliationRows} />
          <TransactionPanel
            parsed={parsed}
            selectedCard={selectedCard}
            onSelectedCardChange={onSelectedCardChange}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          <Upload className="h-4 w-4" />
          Upload Another PDF
        </button>
      )}
    </div>
  );
}

function BillSummary({
  parsed,
  pageCount,
  characterCount,
  exportableRows,
  isCompleteStatement,
  combinedCsvHref,
}: {
  parsed: ParsedStatementResult;
  pageCount: number;
  characterCount: number;
  exportableRows: number;
  isCompleteStatement: boolean;
  combinedCsvHref: string;
}) {
  const computedBalance = computeBalance(parsed.transactions, parsed.metadata.cardNumbers);

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-lg dark:bg-slate-800">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white dark:from-blue-700 dark:to-blue-800 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="mb-2 text-xl font-bold">
            {isCompleteStatement ? "Statement ready" : "Statement extracted with gaps"}
          </h2>
          <p className="text-blue-100 dark:text-blue-200">
            Statement Period: {formatStatementPeriod(parsed)}
          </p>
        </div>
        {isCompleteStatement ? (
          <a
            href={combinedCsvHref}
            download={getCsvFileName(parsed.metadata.statementPeriodEnd)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <Download className="h-4 w-4" />
            Download Combined CSV
          </a>
        ) : null}
      </div>

      <div className="p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-6">
          <MetricCard
            tone="green"
            icon={<ReceiptText className="h-4 w-4 md:h-6 md:w-6" />}
            label="Closing Balance"
            value={formatCurrency(parsed.metadata.closingBalance)}
          />
          <MetricCard
            tone="blue"
            icon={<Calendar className="h-4 w-4 md:h-6 md:w-6" />}
            label="Payment Due Date"
            value={parsed.metadata.minimumDueDate ?? "-"}
            helper={getDueDateHelper(parsed.metadata.minimumDueDate)}
          />
          <MetricCard
            tone="purple"
            icon={<CreditCard className="h-4 w-4 md:h-6 md:w-6" />}
            label="Cards in Bill"
            value={String(parsed.metadata.cardNumbers.length)}
            helper={parsed.metadata.cardNumbers.join(", ") || "-"}
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniMetric label="Computed balance" value={formatCurrency(computedBalance)} />
          <MiniMetric label="Pages" value={String(pageCount)} />
          <MiniMetric label="Characters" value={characterCount.toLocaleString()} />
          <MiniMetric label="Exportable rows" value={String(exportableRows)} />
        </div>
      </div>
    </section>
  );
}

function CardList({
  cardSummary,
  parsed,
}: {
  cardSummary: CardSummary[];
  parsed: ParsedStatementResult;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cards Summary</h2>
      <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              <tr>
                <TableHead>Card</TableHead>
                <TableHead align="right">Purchases</TableHead>
                <TableHead align="right">Credits</TableHead>
                <TableHead align="right">Excluded BPAY</TableHead>
                <TableHead align="right">Net Total</TableHead>
                <TableHead align="right">CSV</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {cardSummary.map((row) => {
                const csvHref = buildCsvHref(
                  buildCsvData(
                    transactionsToExportRows(
                      getTransactionsForCard(parsed.transactions, row.cardNumber),
                      parsed.metadata,
                    ),
                  ),
                );

                return (
                  <tr
                    key={row.cardNumber}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <td className="px-3 py-4 md:px-6">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            Card ending {row.cardNumber}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {getTransactionsForCard(parsed.transactions, row.cardNumber).length} exportable
                            transactions
                          </div>
                        </div>
                      </div>
                    </td>
                    <TableCell align="right">{formatCurrency(row.purchases)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.credits)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.excludedBpay)}</TableCell>
                    <TableCell align="right" strong>
                      {formatCurrency(row.netTotal)}
                    </TableCell>
                    <td className="px-3 py-4 text-right md:px-6">
                      <a
                        href={csvHref}
                        download={getCsvFileName(
                          parsed.metadata.statementPeriodEnd,
                          row.cardNumber,
                        )}
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
                      >
                        CSV
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ReconciliationPanel({ rows }: { rows: ReconciliationRow[] }) {
  return (
    <section className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
      <div className="border-b border-slate-200 p-6 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Reconciliation</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Statement totals compared with parsed transaction totals.
        </p>
      </div>
      <div className="overflow-x-auto p-4 md:p-6">
        <table className="w-full min-w-[42rem]">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
            <tr>
              <TableHead>Item</TableHead>
              <TableHead align="right">Statement</TableHead>
              <TableHead align="right">Parsed</TableHead>
              <TableHead align="right">Delta</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {rows.map((row) => (
              <tr key={row.item} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">
                <TableCell>{row.item}</TableCell>
                <TableCell align="right">{formatCurrency(row.statement)}</TableCell>
                <TableCell align="right">{formatCurrency(row.parsed)}</TableCell>
                <TableCell
                  align="right"
                  strong={row.delta !== null && row.delta !== 0}
                  tone={row.delta !== null && row.delta !== 0 ? "warning" : undefined}
                >
                  {formatCurrency(row.delta)}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransactionPanel({
  parsed,
  selectedCard,
  onSelectedCardChange,
}: {
  parsed: ParsedStatementResult;
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
}) {
  const cardTransactions = selectedCard
    ? getTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const excludedTransactions = selectedCard
    ? getExcludedTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const cardTotal = selectedCard ? computeCardTotal(parsed.transactions, selectedCard) : 0;
  const selectedCardCsvHref = buildCsvHref(
    buildCsvData(transactionsToExportRows(cardTransactions, parsed.metadata)),
  );

  return (
    <section className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label
              htmlFor="card-select"
              className="mb-3 block text-lg font-semibold text-slate-900 dark:text-white"
            >
              View Transaction Details
            </label>
            <div className="relative">
              <select
                id="card-select"
                value={selectedCard}
                onChange={(event) => onSelectedCardChange(event.target.value)}
                className="w-full min-w-0 appearance-none rounded-lg border border-slate-300 bg-white px-4 py-3 pr-10 font-medium text-slate-900 hover:border-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:hover:border-slate-500 md:w-auto md:min-w-[18rem]"
              >
                {parsed.metadata.cardNumbers.map((card) => (
                  <option key={card} value={card}>
                    Card ending {card} - {formatCurrency(computeCardTotal(parsed.transactions, card))}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            </div>
          </div>
        </div>
      </div>

      {selectedCard ? (
        <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 dark:from-blue-950 dark:to-blue-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="mb-1 text-xl font-bold text-slate-900 dark:text-white">
                  Card ending {selectedCard}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {cardTransactions.length} exportable transactions
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="text-left md:text-right">
                  <p className="mb-1 text-sm text-slate-600 dark:text-slate-400">Card Total</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(cardTotal)}
                  </p>
                </div>
                <a
                  href={selectedCardCsvHref}
                  download={getCsvFileName(parsed.metadata.statementPeriodEnd, selectedCard)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </a>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <h4 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white md:text-base">
              All Transactions ({cardTransactions.length})
            </h4>
            {cardTransactions.length > 0 ? (
              <TransactionsTable transactions={cardTransactions} />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No valid transactions found for card ending in {selectedCard}.
              </p>
            )}

            {excludedTransactions.length > 0 ? (
              <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <summary className="cursor-pointer font-medium text-slate-900 dark:text-white">
                  Show excluded rows ({excludedTransactions.length})
                </summary>
                <div className="mt-4">
                  <TransactionsTable transactions={excludedTransactions} excluded />
                </div>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TransactionsTable({
  transactions,
  excluded = false,
}: {
  transactions: Transaction[];
  excluded?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem]">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
          <tr>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead align="right">Amount (AUD)</TableHead>
            {excluded ? <TableHead>Excluded As</TableHead> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {transactions.map((transaction, index) => (
            <tr
              key={`${transaction.cardNumber}-${transaction.date}-${transaction.description}-${index}`}
              className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <TableCell>{transaction.date}</TableCell>
              <TableCell>{transaction.description}</TableCell>
              <TableCell align="right" strong>
                {transaction.isCredit
                  ? `(${formatCurrency(transaction.amountAud)})`
                  : formatCurrency(transaction.amountAud)}
              </TableCell>
              {excluded ? <TableCell>Payment</TableCell> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueCard({ title, issues }: { title: string; issues: string[] }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({
  tone,
  icon,
  label,
  value,
  helper,
}: {
  tone: "green" | "blue" | "purple";
  icon: React.ReactNode;
  label: string;
  value: string;
  helper?: string;
}) {
  const tones = {
    green: {
      card: "from-green-50 to-green-100 border-green-200",
      icon: "bg-green-600 text-white",
      label: "text-green-700",
      value: "text-green-900",
    },
    blue: {
      card: "from-blue-50 to-blue-100 border-blue-200",
      icon: "bg-blue-600 text-white",
      label: "text-blue-700",
      value: "text-blue-900",
    },
    purple: {
      card: "from-purple-50 to-purple-100 border-purple-200",
      icon: "bg-purple-600 text-white",
      label: "text-purple-700",
      value: "text-purple-900",
    },
  }[tone];

  return (
    <div className={`rounded-lg border bg-gradient-to-br p-4 md:rounded-xl md:p-6 ${tones.card}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full md:h-12 md:w-12 ${tones.icon}`}>
          {icon}
        </div>
        <p className={`text-xs font-medium md:text-sm ${tones.label}`}>{label}</p>
      </div>
      <p className={`break-words text-2xl font-bold md:text-3xl ${tones.value}`}>{value}</p>
      {helper ? <p className={`mt-1 text-xs md:text-sm ${tones.label}`}>{helper}</p> : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function TableHead({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={[
        "px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white md:px-6",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  align = "left",
  strong = false,
  tone,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
  tone?: "warning";
}) {
  return (
    <td
      className={[
        "px-3 py-3 text-sm md:px-6",
        align === "right" ? "text-right" : "text-left",
        strong ? "font-semibold" : "",
        tone === "warning"
          ? "text-amber-700 dark:text-amber-300"
          : "text-slate-700 dark:text-slate-300",
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function getStatementIssues(parsed: ParsedStatementResult): string[] {
  const issues: string[] = [];

  if (!parsed.metadata.primaryCard) {
    issues.push("Primary card could not be identified from the statement header.");
  }

  if (parsed.metadata.cardNumbers.length === 0) {
    issues.push("No card numbers were detected in the statement.");
  }

  if (parsed.transactions.length === 0) {
    issues.push("No valid transactions were found in the statement activity pages.");
  }

  return issues;
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

function formatStatementPeriod(parsed: ParsedStatementResult): string {
  if (parsed.metadata.statementFrom && parsed.metadata.statementTo) {
    return `${parsed.metadata.statementFrom} - ${parsed.metadata.statementTo}`;
  }

  return "Not detected";
}

function getDueDateHelper(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const dueDate = Date.parse(value);
  if (Number.isNaN(dueDate)) {
    return undefined;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const daysUntilDue = Math.ceil((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) {
    return `${Math.abs(daysUntilDue)} days overdue`;
  }

  return `${daysUntilDue} days remaining`;
}

function buildCsvHref(csvData: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csvData)}`;
}

function getCsvFileName(statementPeriodEnd: Date | null, cardNumber?: string): string {
  const cardSegment = cardNumber ? `${cardNumber}-` : "";

  if (!statementPeriodEnd || Number.isNaN(statementPeriodEnd.getTime())) {
    return `${cardSegment}card-transactions.csv`;
  }

  return `${statementPeriodEnd.getUTCFullYear()}-${FILE_MONTH_FORMATTER.format(statementPeriodEnd)}-${cardSegment}card-transactions.csv`;
}
