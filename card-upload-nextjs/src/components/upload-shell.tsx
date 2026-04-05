"use client";

import { useId, useRef, useState } from "react";
import styles from "./upload-shell.module.css";
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
  const [selectedCard, setSelectedCard] = useState<string>("");

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFileName(null);
      setExtractionState({ status: "idle" });
      setSelectedCard("");
      return;
    }

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
      const preview = result.pageTexts.find((pageText) => pageText.trim()) ?? "";
      setExtractionState({
        status: "success",
        pageCount: result.pageTexts.length,
        characterCount: result.fullText.length,
        preview: preview.slice(0, 220),
        parsed,
      });
      setSelectedCard(parsed.metadata.cardNumbers[0] ?? "");
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
      setSelectedCard("");
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <p className={styles.panelLabel}>Upload</p>
          <h2>Load a Macquarie Bank credit card statement PDF</h2>
          <p className={styles.panelCopy}>
            This milestone reproduces the current statement workflow in the browser, from upload
            through reconciliation and CSV exports.
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
        <SuccessfulStatementView
          extractionState={extractionState}
          selectedCard={selectedCard}
          onSelectedCardChange={setSelectedCard}
        />
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
      return "Statement ready";
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
      return "The app can now parse supported statement PDFs and expose the current export workflow entirely in the browser.";
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

function SuccessfulStatementView({
  extractionState,
  selectedCard,
  onSelectedCardChange,
}: {
  extractionState: ExtractionState & { status: "success" };
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
}) {
  const { parsed } = extractionState;
  const combinedTransactions = parsed.transactions.filter((transaction) => !transaction.isPayment);
  const hasReconciliationMismatch = parsed.reconciliationRows.some(
    (row) => row.delta !== null && row.delta !== 0,
  );
  const cardTransactions = selectedCard
    ? getTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const excludedTransactions = selectedCard
    ? getExcludedTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const cardTotal = selectedCard ? computeCardTotal(parsed.transactions, selectedCard) : 0;
  const combinedCsvHref = buildCsvHref(
    buildCsvData(transactionsToExportRows(combinedTransactions, parsed.metadata)),
  );

  return (
    <div className={styles.workflow} role="status">
      <section className={styles.summaryCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelLabel}>Statement Summary</p>
            <h3 className={styles.sectionTitle}>Parsed statement ready</h3>
          </div>
          <a
            className={styles.downloadButton}
            href={combinedCsvHref}
            download="credit_card_all_transactions.csv"
          >
            Download Combined CSV
          </a>
        </div>
        <div className={styles.metrics}>
          <Metric label="Closing balance" value={formatCurrency(parsed.metadata.closingBalance)} />
          <Metric label="Due date" value={parsed.metadata.minimumDueDate ?? "-"} small />
          <Metric
            label="Computed balance"
            value={formatCurrency(computeBalance(parsed.transactions, parsed.metadata.cardNumbers))}
          />
          <Metric label="Cards" value={parsed.metadata.cardNumbers.join(", ") || "-"} small />
        </div>
        {hasReconciliationMismatch ? (
          <div className={styles.warningCard} role="alert">
            Parsed totals do not fully reconcile with the statement summary. Review the
            reconciliation section before exporting.
          </div>
        ) : null}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelLabel}>Per-Card Summary</p>
            <h3 className={styles.sectionTitle}>Card totals and exports</h3>
          </div>
        </div>
        <CardSummaryTable cardSummary={parsed.cardSummary} parsed={parsed} />
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelLabel}>Reconciliation</p>
            <h3 className={styles.sectionTitle}>Statement vs parsed totals</h3>
          </div>
        </div>
        <ReconciliationTable rows={parsed.reconciliationRows} />
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelLabel}>Transactions</p>
            <h3 className={styles.sectionTitle}>Card-level transaction view</h3>
          </div>
          <label className={styles.selector}>
            <span className={styles.selectorLabel}>Card ending</span>
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

        {selectedCard ? (
          <>
            <div className={styles.metrics}>
              <Metric
                label={`Transactions for ${selectedCard}`}
                value={String(cardTransactions.length)}
              />
              <Metric label="Total (AUD)" value={formatCurrency(cardTotal)} />
            </div>

            {cardTransactions.length > 0 ? (
              <TransactionsTable transactions={cardTransactions} />
            ) : (
              <p className={styles.statusCopy}>
                No valid transactions found for card ending in {selectedCard}.
              </p>
            )}

            {excludedTransactions.length > 0 ? (
              <details className={styles.auditBlock}>
                <summary className={styles.auditSummary}>
                  Show excluded rows ({excludedTransactions.length})
                </summary>
                <TransactionsTable transactions={excludedTransactions} excluded />
              </details>
            ) : null}
          </>
        ) : null}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.panelLabel}>Extraction Preview</p>
            <h3 className={styles.sectionTitle}>Raw page text debug snapshot</h3>
          </div>
        </div>
        <div className={styles.metrics}>
          <Metric label="Pages" value={String(extractionState.pageCount)} />
          <Metric label="Characters" value={extractionState.characterCount.toLocaleString()} />
        </div>
        <div className={styles.previewBlock}>
          <p className={styles.previewLabel}>First extracted text preview</p>
          <pre className={styles.previewText}>
            {extractionState.preview || "No text was extracted from the first available page."}
          </pre>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={small ? styles.metricValueSmall : undefined}>{value}</strong>
    </div>
  );
}

function CardSummaryTable({
  cardSummary,
  parsed,
}: {
  cardSummary: CardSummary[];
  parsed: ParsedStatementResult;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Card Number</th>
            <th>Purchases</th>
            <th>Credits</th>
            <th>Excluded BPAY</th>
            <th>Net Total</th>
            <th>CSV</th>
          </tr>
        </thead>
        <tbody>
          {cardSummary.map((row) => {
            const csvHref = buildCsvHref(
              buildCsvData(
                transactionsToExportRows(getTransactionsForCard(parsed.transactions, row.cardNumber), parsed.metadata),
              ),
            );
            return (
              <tr key={row.cardNumber}>
                <td>{row.cardNumber}</td>
                <td>{formatCurrency(row.purchases)}</td>
                <td>{formatCurrency(row.credits)}</td>
                <td>{formatCurrency(row.excludedBpay)}</td>
                <td>{formatCurrency(row.netTotal)}</td>
                <td>
                  <a
                    href={csvHref}
                    download={`credit_card_${row.cardNumber}_transactions.csv`}
                    className={styles.inlineLink}
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
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Amount (AUD)</th>
            {excluded ? <th>Excluded As</th> : null}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction, index) => (
            <tr key={`${transaction.cardNumber}-${transaction.date}-${transaction.description}-${index}`}>
              <td>{transaction.date}</td>
              <td>{transaction.description}</td>
              <td>{transaction.isCredit ? `(${formatCurrency(transaction.amountAud)})` : formatCurrency(transaction.amountAud)}</td>
              {excluded ? <td>Payment</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildCsvHref(csvData: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csvData)}`;
}
