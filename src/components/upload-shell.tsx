"use client";

/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";
import styles from "./upload-shell.module.css";
import { ThemeToggle } from "./theme-toggle";
import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";
import { PdfExtractionError, extractPdfText } from "@/lib/pdf-extraction";
import {
  buildCsvData,
  computeBalance,
  computeCardTotal,
  getExcludedTransactionsForCard,
  getTransactionsForCard,
  parseStatementFromExtraction,
  type ParsedStatementResult,
  transactionsToExportRows,
} from "@/lib/statement";
import type { CardSummary, ReconciliationRow, Transaction } from "@/lib/statement";

const ACCEPTED_FILE_TYPES = getAcceptedFileTypes();

type ExtractionState =
  | { status: "idle" }
  | { status: "loading"; fileName: string; fileSize: number }
  | {
      status: "success";
      fileName: string;
      fileSize: number;
      pageCount: number;
      characterCount: number;
      parsed: ParsedStatementResult;
      issues: string[];
    }
  | { status: "error"; title: string; message: string };

type TransactionViewModel = {
  transactions: Transaction[];
  totalSpend: number;
  transactionCount: number;
  statementRange: string;
  combinedCsvHref: string;
  isCompleteStatement: boolean;
  hasReconciliationMismatch: boolean;
};

export function UploadShell() {
  const inputId = useId();
  const requestIdRef = useRef(0);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: "idle" });
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const hasSelectedFile = selectedFileName !== null;

  async function processFile(file: File) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSelectedFileName(file.name);
    setExtractionState({ status: "loading", fileName: file.name, fileSize: file.size });
    setSelectedCard("");

    try {
      const result = await extractPdfText(file);
      if (requestIdRef.current !== requestId) {
        return;
      }

      const parsed = parseStatementFromExtraction(result);
      setExtractionState({
        status: "success",
        fileName: file.name,
        fileSize: file.size,
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

      const extractionError =
        error instanceof PdfExtractionError
          ? {
              title: "Extraction failed",
              message: error.message,
            }
          : {
              title: "Parsing failed",
              message:
                "The PDF text was extracted, but the statement could not be parsed into the supported format.",
            };

      setExtractionState({
        status: "error",
        ...extractionError,
      });
      setSelectedCard("");
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      setExtractionState({ status: "idle" });
      setSelectedCard("");
      return;
    }

    await processFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void processFile(file);
    }
  }

  return (
    <div className={styles.appShell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <img src="/android-chrome-192x192.png" alt="" />
          </span>
          <span>Pampi Card</span>
        </div>
        <p className={styles.headerCopy}>Parse credit card statements in your browser.</p>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <div className={styles.clientBadge}>
            <img src="/android-chrome-192x192.png" alt="" />
            <span>Client-side Only</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section
          className={`${styles.uploadZone} ${hasSelectedFile ? styles.uploadZoneCompact : ""} ${
            isDragging ? styles.uploadZoneActive : ""
          }`}
          data-compact-upload={hasSelectedFile ? "true" : undefined}
          aria-labelledby={`${inputId}-title`}
        >
          <label
            className={styles.dropzone}
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className={styles.iconBubble}>
              <img src="/icons/ui/upload.svg" alt="" />
            </span>
            <h1 className={styles.uploadTitle} id={`${inputId}-title`}>
              {hasSelectedFile ? "Replace credit card statement" : "Upload your credit card statement"}
            </h1>
            <span className={styles.uploadCopy}>
              {hasSelectedFile
                ? "Drop another PDF or choose a local statement to parse again in this browser."
                : "Drag and drop your PDF file here, or choose a local statement to parse in this browser."}
            </span>
            <span className={styles.primaryButton}>
              {hasSelectedFile ? "Choose Replacement PDF" : "Select PDF File"}
            </span>
            <span className={styles.localCheck}>
              <span className={styles.checkIcon}>
                <img src="/icons/ui/check.svg" alt="" />
              </span>
              Keep processing 100% local
            </span>
            <input
              id={inputId}
              name="statement"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className={styles.input}
              aria-label="Select PDF File"
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
        </section>

        <ProcessingStatus state={extractionState} />

        {extractionState.status === "error" ? (
          <div className={styles.errorCard} role="alert">
            <p className={styles.statusTitle}>{extractionState.title}</p>
            <p className={styles.statusCopy}>{extractionState.message}</p>
          </div>
        ) : null}

        {extractionState.status === "success" ? (
          <SuccessfulStatementView
            extractionState={extractionState}
            selectedCard={selectedCard}
            onSelectedCardChange={setSelectedCard}
          />
        ) : (
          <EmptyResults state={extractionState} />
        )}
      </main>
    </div>
  );
}

function ProcessingStatus({ state }: { state: ExtractionState }) {
  if (state.status === "idle" || state.status === "error") {
    return null;
  }

  const statusText = state.status === "loading" ? "Parsing transactions..." : "Parsed";

  return (
    <section className={styles.processingCard} role={state.status === "loading" ? "status" : undefined}>
      <div className={styles.processingFile}>
        <span className={styles.fileIcon}>
          <img src="/icons/ui/file.svg" alt="" />
        </span>
        <div>
          <p className={styles.fileName}>{state.fileName}</p>
          <p className={styles.fileMeta}>PDF Document • {formatFileSize(state.fileSize)}</p>
        </div>
      </div>
      <div className={styles.progressArea}>
        <div className={styles.progressLabels}>
          <span>{statusText}</span>
          <span>{state.status === "success" ? "Done" : "Working"}</span>
        </div>
        <div className={styles.progressTrack}>
          <span className={styles.progressBar} />
        </div>
      </div>
      <div className={styles.parsedBadge}>
        <img src="/icons/ui/check.svg" alt="" />
        <span>{state.status === "success" ? "Parsed" : "Local"}</span>
      </div>
    </section>
  );
}

function EmptyResults({ state }: { state: ExtractionState }) {
  return (
    <section className={styles.emptyResults}>
      <h2>{state.status === "loading" ? "Active Processing" : "Analysis Summary"}</h2>
      <p>
        {state.status === "loading"
          ? "The file is being processed in-browser so statement data never leaves the device."
          : "Upload a supported statement PDF to review totals and export CSV files."}
      </p>
    </section>
  );
}

function SuccessfulStatementView({
  extractionState,
  selectedCard,
  onSelectedCardChange,
}: {
  extractionState: ExtractionState & { status: "success" };
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
}) {
  const view = getTransactionView(extractionState.parsed, extractionState.issues);
  const { parsed } = extractionState;
  const cardTransactions = selectedCard
    ? getTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const excludedTransactions = selectedCard
    ? getExcludedTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const cardTotal = selectedCard ? computeCardTotal(parsed.transactions, selectedCard) : 0;

  return (
    <>
      <section className={styles.mobileSummary}>
        <div className={styles.summaryHeader}>
          <h2>Analysis Summary</h2>
          <details className={styles.detailsDisclosure}>
            <summary>Details</summary>
            <ReconciliationTable rows={parsed.reconciliationRows} />
          </details>
        </div>
        <div className={styles.mobileCards}>
          <SummaryStatCard
            label="Total Spend"
            value={formatCurrency(view.totalSpend)}
            note={`${view.transactionCount} transactions detected`}
            tone="blue"
          />
          <SummaryStatCard
            label="Statement Range"
            value={view.statementRange}
            note={`${extractionState.pageCount} pages parsed`}
            tone="light"
          />
          <SummaryStatCard
            label="Cards"
            value={String(parsed.cardSummary.length)}
            note={parsed.metadata.cardNumbers.map((card) => `•••• ${card}`).join(", ") || "-"}
            tone="white"
          />
        </div>
      </section>

      <section className={styles.contentGrid} aria-label="Parsed statement results">
        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <p className={styles.panelLabel}>Overall Spend</p>
            <strong className={styles.largeValue}>{formatCurrency(view.totalSpend)}</strong>
            <div className={styles.subtleRow}>
              <span>from {view.transactionCount} transactions</span>
              <span className={styles.trend}>
                <img src="/icons/ui/trend.svg" alt="" />
                Local parse
              </span>
            </div>
          </section>

          <section className={styles.panel}>
            <p className={styles.panelLabel}>Statement Details</p>
            <div className={styles.metrics}>
              <Metric label="Date range" value={view.statementRange} small />
              <Metric label="Due date" value={parsed.metadata.minimumDueDate ?? "-"} small />
              <Metric label="Closing balance" value={formatCurrency(parsed.metadata.closingBalance)} />
              <Metric
                label="Computed balance"
                value={formatCurrency(computeBalance(parsed.transactions, parsed.metadata.cardNumbers))}
              />
            </div>
          </section>

          {view.isCompleteStatement ? (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <p className={styles.panelLabel}>Per-Card Totals</p>
                <label className={styles.selector}>
                  <span>Card ending</span>
                  <select
                    value={selectedCard}
                    onChange={(event) => onSelectedCardChange(event.target.value)}
                    className={styles.select}
                  >
                    {parsed.metadata.cardNumbers.map((card) => (
                      <option key={card} value={card}>
                        {card}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <CardSummaryList cardSummary={parsed.cardSummary} parsed={parsed} />
            </section>
          ) : null}

          <section className={styles.exportPanel}>
            <p className={styles.panelLabel}>Export Results</p>
            <p className={styles.exportCopy}>
              Export parsed data into the existing standardized CSV format for spreadsheet analysis.
            </p>
            {view.isCompleteStatement ? (
              <a
                className={styles.downloadButton}
                href={view.combinedCsvHref}
                download="credit_card_all_transactions.csv"
              >
                <img src="/icons/ui/download.svg" alt="" />
                Download Combined CSV
              </a>
            ) : null}
            <div className={styles.localAssurance}>
              <img src="/android-chrome-192x192.png" alt="" />
              No data leaves this computer.
            </div>
          </section>
        </aside>

        <section className={styles.detailsPanel}>
          <div className={styles.statementHeader}>
            <div>
              <h2>Statement Details</h2>
              <p>{view.statementRange}</p>
            </div>
            <div className={styles.clientBadge}>
              <img src="/android-chrome-192x192.png" alt="" />
              <span>Client-side Only</span>
            </div>
          </div>

          {extractionState.issues.length > 0 ? (
            <WarningCard issues={extractionState.issues} />
          ) : null}
          {view.hasReconciliationMismatch ? (
            <div className={styles.warningCard} role="alert">
              Parsed totals do not fully reconcile with the statement summary. Review the Details
              disclosure before exporting.
            </div>
          ) : null}

          {view.isCompleteStatement ? (
            <>
              <div className={styles.selectedCardSummary}>
                <Metric label={`Transactions for ${selectedCard}`} value={String(cardTransactions.length)} />
                <Metric label="Total (AUD)" value={formatCurrency(cardTotal)} />
                <Metric label="Pages" value={String(extractionState.pageCount)} />
                <Metric label="Characters" value={extractionState.characterCount.toLocaleString()} />
              </div>

              <TransactionsTable transactions={cardTransactions} />
              <TransactionsList transactions={cardTransactions} />

              {excludedTransactions.length > 0 ? (
                <details className={styles.auditBlock}>
                  <summary className={styles.auditSummary}>
                    Show excluded rows ({excludedTransactions.length})
                  </summary>
                  <TransactionsTable transactions={excludedTransactions} excluded />
                </details>
              ) : null}

              <details className={styles.reconciliationBlock}>
                <summary className={styles.auditSummary}>Details</summary>
                <ReconciliationTable rows={parsed.reconciliationRows} />
              </details>
            </>
          ) : null}
        </section>
      </section>

      {view.isCompleteStatement ? (
        <div className={styles.stickyAction}>
          <a
            className={styles.stickyButton}
            href={view.combinedCsvHref}
            download="credit_card_all_transactions.csv"
          >
            <img src="/icons/ui/download.svg" alt="" />
            Download Summary CSV
          </a>
          <div className={styles.localAssurance}>
            <img src="/android-chrome-192x192.png" alt="" />
            Client-side Only
          </div>
        </div>
      ) : null}
    </>
  );
}

function getTransactionView(parsed: ParsedStatementResult, issues: string[]): TransactionViewModel {
  const transactions = parsed.transactions.filter((transaction) => !transaction.isPayment);
  const fallbackSpend = transactions.reduce((total, transaction) => {
    return transaction.isCredit ? total - transaction.amountAud : total + transaction.amountAud;
  }, 0);
  const totalSpend = parsed.metadata.purchasesTotal ?? fallbackSpend;

  return {
    transactions,
    totalSpend,
    transactionCount: transactions.length,
    statementRange: getStatementRange(parsed),
    combinedCsvHref: buildCsvHref(buildCsvData(transactionsToExportRows(transactions, parsed.metadata))),
    isCompleteStatement: issues.length === 0,
    hasReconciliationMismatch: parsed.reconciliationRows.some(
      (row) => row.delta !== null && row.delta !== 0,
    ),
  };
}

function getStatementRange(parsed: ParsedStatementResult): string {
  if (parsed.metadata.statementFrom && parsed.metadata.statementTo) {
    return `${parsed.metadata.statementFrom} - ${parsed.metadata.statementTo}`;
  }

  if (parsed.metadata.statementPeriodStart && parsed.metadata.statementPeriodEnd) {
    return `${formatDate(parsed.metadata.statementPeriodStart)} - ${formatDate(
      parsed.metadata.statementPeriodEnd,
    )}`;
  }

  return "Statement range unavailable";
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

function Metric({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong className={small ? styles.metricValueSmall : undefined}>{value}</strong>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "blue" | "light" | "white";
}) {
  return (
    <article className={`${styles.summaryStatCard} ${styles[`summaryStatCard${capitalize(tone)}`]}`}>
      <div className={styles.summaryStatTop}>
        <span>{label}</span>
        <span className={styles.summaryIcon}>
          <img src="/icons/ui/receipt.svg" alt="" />
        </span>
      </div>
      <div>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}

function CardSummaryList({
  cardSummary,
  parsed,
}: {
  cardSummary: CardSummary[];
  parsed: ParsedStatementResult;
}) {
  return (
    <div className={styles.cardList}>
      {cardSummary.map((row) => {
        const csvHref = buildCsvHref(
          buildCsvData(
            transactionsToExportRows(getTransactionsForCard(parsed.transactions, row.cardNumber), parsed.metadata),
          ),
        );
        return (
          <div className={styles.cardRow} key={row.cardNumber}>
            <div>
              <span className={styles.cardType}>Card</span>
              <span>•••• {row.cardNumber}</span>
            </div>
            <strong>{formatCurrency(row.netTotal)}</strong>
            <a
              href={csvHref}
              download={`credit_card_${row.cardNumber}_transactions.csv`}
              className={styles.inlineLink}
            >
              CSV
            </a>
          </div>
        );
      })}
    </div>
  );
}

function WarningCard({ issues }: { issues: string[] }) {
  return (
    <div className={styles.warningCard} role="alert">
      <p className={styles.noticeTitle}>This statement is not ready for export yet.</p>
      <ul className={styles.issueList}>
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function ReconciliationTable({ rows }: { rows: ReconciliationRow[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Statement</th>
            <th>Parsed</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item}>
              <td>{row.item}</td>
              <td>{formatCurrency(row.statement)}</td>
              <td>{formatCurrency(row.parsed)}</td>
              <td className={row.delta && row.delta !== 0 ? styles.deltaWarning : undefined}>
                {formatCurrency(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className={`${styles.tableCard} ${excluded ? "" : styles.resultsTableCard}`}>
      <div className={`${styles.tableWrap} ${excluded ? "" : styles.resultsTableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Card</th>
              <th>Amount</th>
              {excluded ? <th>Excluded As</th> : null}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={`${transaction.cardNumber}-${transaction.date}-${transaction.description}-${index}`}>
                <td>{transaction.date}</td>
                <td>
                  <div className={styles.merchantCell}>
                    <span>{getInitials(transaction.description)}</span>
                    <strong>{transaction.description}</strong>
                  </div>
                </td>
                <td>Card •••• {transaction.cardNumber}</td>
                <td className={styles.amountCell}>{formatTransactionAmount(transaction)}</td>
                {excluded ? <td>Payment</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableFooter}>
        Showing {transactions.length} transactions detected for this card
      </div>
    </div>
  );
}

function TransactionsList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className={styles.transactionList}>
      {transactions.map((transaction, index) => (
        <article
          className={styles.transactionItem}
          key={`${transaction.cardNumber}-${transaction.date}-${transaction.description}-${index}`}
        >
          <span className={styles.transactionAvatar}>{getInitials(transaction.description)}</span>
          <div>
            <strong>{transaction.description}</strong>
            <span>
              {transaction.date} • Card ending {transaction.cardNumber}
            </span>
          </div>
          <strong>{formatTransactionAmount(transaction)}</strong>
        </article>
      ))}
    </div>
  );
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

function formatTransactionAmount(transaction: Transaction): string {
  const value = formatCurrency(transaction.amountAud);
  return transaction.isCredit ? `(${value})` : value;
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(description: string): string {
  const letters = description
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return letters || "TX";
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function buildCsvHref(csvData: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csvData)}`;
}
