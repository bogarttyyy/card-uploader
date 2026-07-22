"use client";

import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  Upload,
} from "lucide-react";
import { useId } from "react";
import { CsvDownload } from "@/components/csv-download";
import {
  buildCombinedCardCsvData,
  buildCsvData,
  computeCardTotal,
  getExcludedTransactionsForCard,
  getTransactionsForCard,
  transactionsToExportRows,
  type CardSummary,
  type ParsedStatementResult,
  type ReconciliationRow,
  type Transaction,
} from "@/lib/statement";

const FILE_MONTH_FORMATTER = new Intl.DateTimeFormat("en-AU", {
  month: "short",
  timeZone: "UTC",
});

type StatementResultsProps = {
  parsed: ParsedStatementResult;
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
  onReset: () => void;
};

export function StatementResults({
  parsed,
  selectedCard,
  onSelectedCardChange,
  onReset,
}: StatementResultsProps) {
  const canExport = parsed.validation.isExportReady;
  const combinedTransactions = parsed.transactions.filter((transaction) => !transaction.isPayment);
  const combinedCsvData = buildCombinedCardCsvData(
    transactionsToExportRows(combinedTransactions, parsed.metadata),
    parsed.metadata.cardNumbers,
  );
  const hasParsedActivity = parsed.metadata.cardNumbers.length > 0 && parsed.transactions.length > 0;

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">
        Statement processing complete.
      </p>

      <StatementSummary
        parsed={parsed}
        canExport={canExport}
        combinedCsvData={combinedCsvData}
      />

      {parsed.validation.issues.length > 0 ? (
        <IssueCard
          title="This statement is not ready for export yet."
          issues={parsed.validation.issues.map((issue) => issue.message)}
        />
      ) : null}

      {parsed.validation.warnings.length > 0 ? (
        <IssueCard
          title="Statement warning"
          issues={parsed.validation.warnings.map((warning) => warning.message)}
        />
      ) : null}

      {hasParsedActivity ? (
        <>
          <ReconciliationPanel rows={parsed.reconciliationRows} />
          <CardSummaries cardSummary={parsed.cardSummary} transactions={parsed.transactions} />
          <TransactionPanel
            parsed={parsed}
            selectedCard={selectedCard}
            onSelectedCardChange={onSelectedCardChange}
            canExport={canExport}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-offset-slate-950"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          Upload another PDF
        </button>
      )}
    </div>
  );
}

function StatementSummary({
  parsed,
  canExport,
  combinedCsvData,
}: {
  parsed: ParsedStatementResult;
  canExport: boolean;
  combinedCsvData: string;
}) {
  return (
    <section
      aria-labelledby="statement-summary-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-7"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="statement-summary-heading"
              className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Closing balance
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {canExport ? "Ready to export" : "Review required"}
            </span>
          </div>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950 dark:text-white md:text-5xl">
            {formatCurrency(parsed.metadata.closingBalance)}
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Statement period · {formatStatementPeriod(parsed)}
          </p>
        </div>

        {canExport ? (
          <CsvDownload
            csvData={combinedCsvData}
            fileName={getCsvFileName(parsed.metadata.statementPeriodEnd)}
            ariaLabel="Download combined CSV for all cards"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus-visible:ring-offset-slate-900 md:w-auto"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download Combined CSV
          </CsvDownload>
        ) : null}
      </div>

      <dl className="mt-7 grid grid-cols-1 border-t border-slate-200 pt-5 dark:border-slate-800 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 dark:sm:divide-slate-800">
        <div className="pb-4 sm:pb-0 sm:pr-6">
          <dt className="text-sm text-slate-500 dark:text-slate-400">Payment due date</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
            {parsed.metadata.minimumDueDate ?? "Not detected"}
          </dd>
        </div>
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800 sm:border-t-0 sm:pl-6 sm:pt-0">
          <dt className="text-sm text-slate-500 dark:text-slate-400">Cards in statement</dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
            {parsed.metadata.cardNumbers.length}
          </dd>
          <dd className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {parsed.metadata.cardNumbers.join(", ") || "Not detected"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function ReconciliationPanel({ rows }: { rows: ReconciliationRow[] }) {
  const allMatch = rows.length > 0 && rows.every((row) => row.delta !== null && row.delta === 0);

  return (
    <section aria-label="Reconciliation">
      <details
        open={!allMatch}
        className={[
          "group overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-slate-900",
          allMatch
            ? "border-slate-200 dark:border-slate-800"
            : "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20",
        ].join(" ")}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 md:px-6 [&::-webkit-details-marker]:hidden">
          {allMatch ? (
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
          )}
          <span className="flex-1 font-semibold text-slate-950 dark:text-white">
            {allMatch ? "All statement totals match" : "Statement totals need review"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180 dark:text-slate-400"
          />
        </summary>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800 md:p-6">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Statement totals compared with parsed transaction totals.
          </p>
          <ReconciliationMobileList rows={rows} />
          <div className="hidden md:block">
            <table className="w-full table-fixed">
              <caption className="sr-only">Statement reconciliation totals</caption>
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                <tr>
                  <TableHead>Item</TableHead>
                  <TableHead align="right">Statement</TableHead>
                  <TableHead align="right">Parsed</TableHead>
                  <TableHead align="right">Delta</TableHead>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.item}>
                    <TableCell>{row.item}</TableCell>
                    <TableCell align="right">{formatCurrency(row.statement)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.parsed)}</TableCell>
                    <TableCell
                      align="right"
                      strong
                      tone={row.delta === null || row.delta !== 0 ? "warning" : "success"}
                    >
                      {formatCurrency(row.delta)}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </section>
  );
}

function ReconciliationMobileList({ rows }: { rows: ReconciliationRow[] }) {
  return (
    <div className="space-y-3 md:hidden" role="group" aria-label="Statement reconciliation totals">
      {rows.map((row) => {
        const hasWarning = row.delta === null || row.delta !== 0;
        return (
          <article
            key={row.item}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <h3 className="font-semibold text-slate-950 dark:text-white">{row.item}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Statement</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-300">{formatCurrency(row.statement)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-slate-500 dark:text-slate-400">Parsed</dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-300">{formatCurrency(row.parsed)}</dd>
              </div>
              <div className="col-span-2 mt-1 border-t border-slate-200 pt-3 text-right dark:border-slate-800">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Delta
                </dt>
                <dd
                  className={[
                    "mt-1 text-lg font-bold",
                    hasWarning
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-green-700 dark:text-green-400",
                  ].join(" ")}
                >
                  {formatCurrency(row.delta)}
                </dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

function CardSummaries({
  cardSummary,
  transactions,
}: {
  cardSummary: CardSummary[];
  transactions: Transaction[];
}) {
  return (
    <section aria-labelledby="card-summary-heading" className="space-y-4">
      <h2 id="card-summary-heading" className="text-xl font-bold text-slate-950 dark:text-white">
        Card summary
      </h2>

      <div className="space-y-3 md:hidden">
        {cardSummary.map((row) => (
          <article
            key={row.cardNumber}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <CreditCard aria-hidden="true" className="h-5 w-5 text-slate-400" />
              <h3 className="font-semibold text-slate-950 dark:text-white">
                Card ending {row.cardNumber}
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {getTransactionsForCard(transactions, row.cardNumber).length} exportable transactions
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <SummaryValue label="Purchases" value={formatCurrency(row.purchases)} />
              <SummaryValue label="Credits" value={formatCurrency(row.credits)} align="right" />
              <SummaryValue label="Excluded BPAY" value={formatCurrency(row.excludedBpay)} />
              <SummaryValue
                label="Net total"
                value={formatCurrency(row.netTotal)}
                align="right"
                emphasized
              />
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
        <table className="w-full table-fixed">
          <caption className="sr-only">Summary for each card</caption>
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <TableHead>Card</TableHead>
              <TableHead align="right">Purchases</TableHead>
              <TableHead align="right">Credits</TableHead>
              <TableHead align="right">Excluded BPAY</TableHead>
              <TableHead align="right">Net Total</TableHead>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {cardSummary.map((row) => (
              <tr key={row.cardNumber}>
                <TableCell>
                  <span className="font-medium text-slate-950 dark:text-white">
                    Card ending {row.cardNumber}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {getTransactionsForCard(transactions, row.cardNumber).length} transactions
                  </span>
                </TableCell>
                <TableCell align="right">{formatCurrency(row.purchases)}</TableCell>
                <TableCell align="right">{formatCurrency(row.credits)}</TableCell>
                <TableCell align="right">{formatCurrency(row.excludedBpay)}</TableCell>
                <TableCell align="right" strong>{formatCurrency(row.netTotal)}</TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryValue({
  label,
  value,
  align = "left",
  emphasized = false,
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  emphasized?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={[
          "mt-1 text-slate-700 dark:text-slate-300",
          emphasized ? "text-lg font-bold text-slate-950 dark:text-white" : "font-medium",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

function TransactionPanel({
  parsed,
  selectedCard,
  onSelectedCardChange,
  canExport,
}: {
  parsed: ParsedStatementResult;
  selectedCard: string;
  onSelectedCardChange: (card: string) => void;
  canExport: boolean;
}) {
  const selectId = useId();
  const cardTransactions = selectedCard
    ? getTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const excludedTransactions = selectedCard
    ? getExcludedTransactionsForCard(parsed.transactions, selectedCard)
    : [];
  const cardTotal = selectedCard ? computeCardTotal(parsed.transactions, selectedCard) : 0;
  const selectedCardCsvData = buildCsvData(
    transactionsToExportRows(cardTransactions, parsed.metadata),
  );

  if (!selectedCard) {
    return null;
  }

  return (
    <section
      aria-labelledby="transactions-heading"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-200 p-4 dark:border-slate-800 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <h2 id="transactions-heading" className="text-xl font-bold text-slate-950 dark:text-white">
              Transactions
            </h2>
            <label
              htmlFor={selectId}
              className="mt-4 block text-sm font-medium text-slate-600 dark:text-slate-400"
            >
              Card
            </label>
            <div className="relative mt-1.5 max-w-sm">
              <select
                id={selectId}
                value={selectedCard}
                onChange={(event) => onSelectedCardChange(event.target.value)}
                className="min-h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 font-semibold text-slate-950 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600 dark:focus-visible:ring-offset-slate-900"
              >
                {parsed.metadata.cardNumbers.map((card) => (
                  <option key={card} value={card}>
                    Card ending {card}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
            <div className="sm:text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">Card total</p>
              <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                {formatCurrency(cardTotal)}
              </p>
            </div>
            {canExport ? (
              <CsvDownload
                csvData={selectedCardCsvData}
                fileName={getCsvFileName(parsed.metadata.statementPeriodEnd, selectedCard)}
                ariaLabel={`Download selected card ${selectedCard} CSV`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-400 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                Download card CSV
              </CsvDownload>
            ) : (
              <p className="max-w-xs text-sm font-medium text-amber-700 dark:text-amber-300">
                Downloads blocked until reconciliation is complete.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-950 dark:text-white">
          All transactions ({cardTransactions.length})
        </h3>
        {cardTransactions.length > 0 ? (
          <TransactionsView
            transactions={cardTransactions}
            caption={`Transactions for card ending ${selectedCard}`}
          />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No valid transactions found for card ending in {selectedCard}.
          </p>
        )}

        {excludedTransactions.length > 0 ? (
          <details className="group mt-5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-medium text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:text-white [&::-webkit-details-marker]:hidden">
              Show excluded rows ({excludedTransactions.length})
              <ChevronDown aria-hidden="true" className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <TransactionsView
                transactions={excludedTransactions}
                caption={`Excluded payments for card ending ${selectedCard}`}
                excluded
              />
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function TransactionsView({
  transactions,
  caption,
  excluded = false,
}: {
  transactions: Transaction[];
  caption: string;
  excluded?: boolean;
}) {
  return (
    <>
      <MobileTransactionList transactions={transactions} label={caption} excluded={excluded} />
      <div className="hidden md:block">
        <table className="w-full table-fixed">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <tr>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead align="right" className="w-40">Amount (AUD)</TableHead>
              {excluded ? <TableHead className="w-32">Excluded as</TableHead> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {transactions.map((transaction, index) => (
              <tr key={transactionKey(transaction, index)}>
                <TableCell>{transaction.date}</TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell align="right" strong>{formatTransactionAmount(transaction)}</TableCell>
                {excluded ? <TableCell>Payment</TableCell> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileTransactionList({
  transactions,
  label,
  excluded,
}: {
  transactions: Transaction[];
  label: string;
  excluded: boolean;
}) {
  const groups = groupTransactionsByDate(transactions);

  return (
    <div className="space-y-5 md:hidden" role="group" aria-label={label}>
      {groups.map(([date, dateTransactions]) => (
        <div key={date}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {date}
          </h4>
          <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {dateTransactions.map((transaction, index) => (
              <li
                key={transactionKey(transaction, index)}
                className="flex min-w-0 items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-slate-800 dark:text-slate-200">
                    {transaction.description}
                  </p>
                  {excluded ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Excluded as payment</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-right text-sm font-semibold text-slate-950 dark:text-white">
                  {formatTransactionAmount(transaction)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function IssueCard({ title, issues }: { title: string; issues: string[] }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {issues.map((issue) => <li key={issue}>{issue}</li>)}
      </ul>
    </div>
  );
}

function TableHead({
  children,
  align = "left",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={[
        "px-4 py-3 text-sm font-semibold text-slate-950 dark:text-white",
        align === "right" ? "text-right" : "text-left",
        className,
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
  tone?: "warning" | "success";
}) {
  return (
    <td
      className={[
        "break-words px-4 py-3 text-sm",
        align === "right" ? "text-right" : "text-left",
        strong ? "font-semibold" : "",
        tone === "warning"
          ? "text-amber-700 dark:text-amber-300"
          : tone === "success"
            ? "text-green-700 dark:text-green-400"
            : "text-slate-700 dark:text-slate-300",
      ].join(" ")}
    >
      {children}
    </td>
  );
}

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number | null): string {
  return value === null ? "-" : CURRENCY_FORMATTER.format(value);
}

function formatTransactionAmount(transaction: Transaction): string {
  const amount = formatCurrency(transaction.amountAud);
  return transaction.isCredit ? `(${amount})` : amount;
}

function formatStatementPeriod(parsed: ParsedStatementResult): string {
  if (parsed.metadata.statementFrom && parsed.metadata.statementTo) {
    return `${parsed.metadata.statementFrom} – ${parsed.metadata.statementTo}`;
  }
  return "Not detected";
}

function getCsvFileName(statementPeriodEnd: Date | null, cardNumber?: string): string {
  const cardSegment = cardNumber ? `${cardNumber}-` : "";
  if (!statementPeriodEnd || Number.isNaN(statementPeriodEnd.getTime())) {
    return `${cardSegment}card-transactions.csv`;
  }
  return `${statementPeriodEnd.getUTCFullYear()}-${FILE_MONTH_FORMATTER.format(statementPeriodEnd)}-${cardSegment}card-transactions.csv`;
}

function groupTransactionsByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const group = groups.get(transaction.date) ?? [];
    group.push(transaction);
    groups.set(transaction.date, group);
  }
  return [...groups.entries()];
}

function transactionKey(transaction: Transaction, index: number): string {
  return `${transaction.cardNumber}-${transaction.date}-${transaction.description}-${index}`;
}
