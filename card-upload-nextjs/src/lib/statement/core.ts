import type {
  CardSummary,
  ExportRow,
  ReconciliationRow,
  StatementMetadata,
  Transaction,
} from "@/lib/statement/types";

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_INDEX_BY_ABBR: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export function parseAmount(value: string): number {
  return Number.parseFloat(value.replaceAll(",", ""));
}

export function formatStatementDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return DISPLAY_DATE_FORMATTER.format(parseSlashDate(value));
}

export function parseStatementPeriodDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  return parseSlashDate(value);
}

export function getTransactionsForCard(
  transactions: Transaction[],
  selectedCard: string,
): Transaction[] {
  return transactions.filter(
    (transaction) => transaction.cardNumber === selectedCard && !transaction.isPayment,
  );
}

export function getExcludedTransactionsForCard(
  transactions: Transaction[],
  selectedCard: string,
): Transaction[] {
  return transactions.filter(
    (transaction) => transaction.cardNumber === selectedCard && transaction.isPayment,
  );
}

export function computeSignedAmount(transaction: Transaction): number {
  if (transaction.isPayment) {
    return 0;
  }

  if (transaction.isCredit) {
    return -transaction.amountAud;
  }

  return transaction.amountAud;
}

export function computeCardTotal(transactions: Transaction[], selectedCard: string): number {
  return roundCurrency(
    transactions.reduce((total, transaction) => {
      if (transaction.cardNumber !== selectedCard) {
        return total;
      }

      return total + computeSignedAmount(transaction);
    }, 0),
  );
}

export function computeBalance(transactions: Transaction[], cardNumbers: string[]): number {
  return roundCurrency(
    cardNumbers.reduce((total, cardNumber) => total + computeCardTotal(transactions, cardNumber), 0),
  );
}

export function summarizeCard(transactions: Transaction[], selectedCard: string): CardSummary {
  let purchases = 0;
  let credits = 0;
  let payments = 0;

  for (const transaction of transactions) {
    if (transaction.cardNumber !== selectedCard) {
      continue;
    }

    if (transaction.isPayment) {
      payments += transaction.amountAud;
    } else if (transaction.isCredit) {
      credits += transaction.amountAud;
    } else {
      purchases += transaction.amountAud;
    }
  }

  return {
    cardNumber: selectedCard,
    purchases: roundCurrency(purchases),
    credits: roundCurrency(credits),
    excludedBpay: roundCurrency(payments),
    netTotal: roundCurrency(purchases - credits),
  };
}

export function buildCardSummary(
  transactions: Transaction[],
  cardNumbers: string[],
): CardSummary[] {
  return cardNumbers.map((cardNumber) => summarizeCard(transactions, cardNumber));
}

export function buildReconciliationRows(
  metadata: StatementMetadata,
  transactions: Transaction[],
  cardNumbers: string[],
): ReconciliationRow[] {
  const cardSummary = buildCardSummary(transactions, cardNumbers);
  const parsedPurchases = sum(cardSummary.map((item) => item.purchases));
  const parsedCredits = sum(cardSummary.map((item) => item.credits));
  const parsedPayments = sum(cardSummary.map((item) => item.excludedBpay));
  const parsedPaymentsAndCredits = parsedCredits + parsedPayments;

  const rows: ReconciliationRow[] = [
    buildReconciliationRow("Opening Balance", metadata.openingBalance, metadata.openingBalance),
    buildReconciliationRow("Purchases", metadata.purchasesTotal, parsedPurchases),
    buildReconciliationRow(
      "Payments and Credits",
      metadata.paymentsAndCredits,
      parsedPaymentsAndCredits,
    ),
    buildReconciliationRow("Closing Balance", metadata.closingBalance, metadata.closingBalance),
  ];

  const computedClosing =
    metadata.openingBalance === null
      ? null
      : metadata.openingBalance + parsedPurchases - parsedPaymentsAndCredits;

  rows.push(
    buildReconciliationRow("Computed Closing Balance", metadata.closingBalance, computedClosing),
  );

  return rows;
}

export function normalizeTransactionDate(
  transactionDate: string,
  metadata: StatementMetadata,
): string {
  if (!metadata.statementPeriodStart || !metadata.statementPeriodEnd) {
    return transactionDate;
  }

  const [monthAbbr, dayText] = transactionDate.split(/\s+/);
  const monthIndex = MONTH_INDEX_BY_ABBR[monthAbbr];
  const day = Number.parseInt(dayText, 10);
  const candidateYears = new Set([
    metadata.statementPeriodStart.getUTCFullYear() - 1,
    metadata.statementPeriodStart.getUTCFullYear(),
    metadata.statementPeriodEnd.getUTCFullYear(),
    metadata.statementPeriodEnd.getUTCFullYear() + 1,
  ]);

  const candidates = [...candidateYears]
    .sort((left, right) => left - right)
    .map((year) => createUtcDate(year, monthIndex, day))
    .filter((candidate): candidate is Date => candidate !== null)
    .filter(
      (candidate) =>
        candidate.getTime() >= metadata.statementPeriodStart!.getTime() &&
        candidate.getTime() <= metadata.statementPeriodEnd!.getTime(),
    );

  if (candidates.length === 0) {
    return formatIsoDate(
      createUtcDate(metadata.statementPeriodEnd.getUTCFullYear(), monthIndex, day) ??
        metadata.statementPeriodEnd,
    );
  }

  return formatIsoDate(candidates[0]);
}

export function transactionsToExportRows(
  transactions: Transaction[],
  metadata: StatementMetadata,
): ExportRow[] {
  return transactions.map((transaction) => ({
    "Card Number": transaction.cardNumber,
    Date: normalizeTransactionDate(transaction.date, metadata),
    Description: transaction.description,
    "Amount (AUD)": transaction.isCredit ? -transaction.amountAud : transaction.amountAud,
  }));
}

export function buildCsvData(rows: ExportRow[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers: (keyof ExportRow)[] = ["Card Number", "Date", "Description", "Amount (AUD)"];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return lines.join("\n");
}

function buildReconciliationRow(
  item: string,
  statementValue: number | null,
  parsedValue: number | null,
): ReconciliationRow {
  let delta: number | null = null;
  if (statementValue !== null && parsedValue !== null) {
    delta = roundCurrency(parsedValue - statementValue);
  }

  return {
    item,
    statement: statementValue,
    parsed: parsedValue === null ? null : roundCurrency(parsedValue),
    delta,
  };
}

function parseSlashDate(value: string): Date {
  const [dayText, monthText, yearText] = value.split("/");
  const day = Number.parseInt(dayText, 10);
  const monthIndex = Number.parseInt(monthText, 10) - 1;
  const year = 2000 + Number.parseInt(yearText, 10);
  const date = createUtcDate(year, monthIndex, day);

  if (!date) {
    throw new Error(`Invalid statement date: ${value}`);
  }

  return date;
}

function createUtcDate(year: number, monthIndex: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function escapeCsvValue(value: string | number): string {
  if (typeof value === "number") {
    return String(value);
  }

  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
