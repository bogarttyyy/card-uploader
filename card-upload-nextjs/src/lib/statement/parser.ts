import { extractPdfText, type PdfTextExtractionResult } from "@/lib/pdf-extraction";
import {
  buildCardSummary,
  buildReconciliationRows,
  formatStatementDate,
  parseAmount,
  parseStatementPeriodDate,
} from "@/lib/statement/core";
import type { CardSummary, ReconciliationRow, StatementMetadata, Transaction } from "@/lib/statement/types";

const TRANSACTION_LINE_RE =
  /^([A-Za-z]{3}\s+\d{1,2})\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s+(CR))?$/;
const DATE_ONLY_RE = /^([A-Za-z]{3}\s+\d{1,2})$/;
const AMOUNT_ONLY_RE = /^(\d{1,3}(?:,\d{3})*\.\d{2})(?:\s+(CR))?$/;
const MAIN_HEADER_RE = /^DATE TRANSACTION DETAILS AMOUNT \$$/;
const CARD_HEADER_RE = /^DATE TRANSACTION DETAILS Card no\. XXXX XXXX XXXX (\d{4}) AMOUNT \$$/;
const CARD_NUMBER_RE = /Card no\.\s+XXXX XXXX XXXX (\d{4})/g;
const ACCOUNT_NUMBER_RE = /Account number\s+XXXX XXXX XXXX (\d{4})/;
const ACCOUNT_HEADER_RE = /^Account No\.$|^Account No\.\s+XXXX XXXX XXXX (\d{4})$/;
const STATEMENT_PERIOD_RE = /Statement period\s+(\d{2}\/\d{2}\/\d{2})-(\d{2}\/\d{2}\/\d{2})/;
const MINIMUM_DUE_DATE_RE = /Minimum payment due date\s+(\d{2}\/\d{2}\/\d{2})/;
const CLOSING_BALANCE_RE = /Closing balance\s*\$([\d,]+\.\d{2})/;
const OPENING_BALANCE_RE = /Opening balance\s*\$([\d,]+\.\d{2})/;
const PAYMENTS_AND_CREDITS_RE = /Payments and credits\s*\$([\d,]+\.\d{2})\s*CR/;
const PURCHASES_RE = /Purchases\s*\$([\d,]+\.\d{2})/;
const REFERENCE_NUMBER_RE = /^\d{14,}$/;
const FOREIGN_CURRENCY_RE = /^[A-Z][A-Z ]+\s+\d[\d,]*\.\d{2}$/;
const PAYMENT_PREFIX = "BPAY PAYMENT - THANK YOU";

export type ParsedStatementResult = {
  metadata: StatementMetadata;
  transactions: Transaction[];
  cardSummary: CardSummary[];
  reconciliationRows: ReconciliationRow[];
};

export async function parseStatementFromPdf(file: File): Promise<ParsedStatementResult> {
  const extraction = await extractPdfText(file);
  return parseStatementFromExtraction(extraction);
}

export function parseStatementFromExtraction(
  extraction: PdfTextExtractionResult,
): ParsedStatementResult {
  const metadata = getStatementMetadata(extraction.fullText);
  const transactions = parseTransactionPages(extraction.pageTexts, metadata.primaryCard);
  return {
    metadata,
    transactions,
    cardSummary: buildCardSummary(transactions, metadata.cardNumbers),
    reconciliationRows: buildReconciliationRows(metadata, transactions, metadata.cardNumbers),
  };
}

export function getStatementMetadata(fullText: string): StatementMetadata {
  const closingBalanceMatch = CLOSING_BALANCE_RE.exec(fullText);
  const openingBalanceMatch = OPENING_BALANCE_RE.exec(fullText);
  const paymentsAndCreditsMatch = PAYMENTS_AND_CREDITS_RE.exec(fullText);
  const purchasesMatch = PURCHASES_RE.exec(fullText);
  const statementPeriodMatch = STATEMENT_PERIOD_RE.exec(fullText);
  const minimumDueDateMatch = MINIMUM_DUE_DATE_RE.exec(fullText);
  const primaryCardMatch = ACCOUNT_NUMBER_RE.exec(fullText);

  const cardNumbers: string[] = [];
  const primaryCard = primaryCardMatch?.[1] ?? null;
  if (primaryCard) {
    cardNumbers.push(primaryCard);
  }

  for (const match of fullText.matchAll(CARD_NUMBER_RE)) {
    const card = match[1];
    if (!cardNumbers.includes(card)) {
      cardNumbers.push(card);
    }
  }

  const statementFrom = statementPeriodMatch?.[1] ?? null;
  const statementTo = statementPeriodMatch?.[2] ?? null;
  const minimumDueDate = minimumDueDateMatch?.[1] ?? null;

  return {
    closingBalance: closingBalanceMatch ? parseAmount(closingBalanceMatch[1]) : null,
    openingBalance: openingBalanceMatch ? parseAmount(openingBalanceMatch[1]) : null,
    paymentsAndCredits: paymentsAndCreditsMatch ? parseAmount(paymentsAndCreditsMatch[1]) : null,
    purchasesTotal: purchasesMatch ? parseAmount(purchasesMatch[1]) : null,
    statementPeriodStart: parseStatementPeriodDate(statementFrom),
    statementPeriodEnd: parseStatementPeriodDate(statementTo),
    statementFrom: formatStatementDate(statementFrom),
    statementTo: formatStatementDate(statementTo),
    minimumDueDate: formatStatementDate(minimumDueDate),
    primaryCard,
    cardNumbers,
  };
}

export function parseTransactionPages(
  pageTexts: string[],
  primaryCard: string | null,
): Transaction[] {
  const transactions: Transaction[] = [];

  for (const pageText of pageTexts) {
    if (!pageText.includes("DATE") || !pageText.includes("TRANSACTION DETAILS")) {
      continue;
    }

    let currentCard: string | null = null;
    const lines = pageText.split("\n").map((line) => line.trim()).filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const cardHeaderMatch = CARD_HEADER_RE.exec(line);
      if (cardHeaderMatch?.[1]) {
        currentCard = cardHeaderMatch[1];
        continue;
      }

      if (MAIN_HEADER_RE.test(line)) {
        currentCard = primaryCard;
        continue;
      }

      const splitHeaderCard = matchSplitCardHeader(lines, index);
      if (splitHeaderCard) {
        currentCard = splitHeaderCard;
        index += 3;
        continue;
      }

      if (isSplitMainHeader(lines, index)) {
        currentCard = primaryCard;
        index += 2;
        continue;
      }

      if (shouldStopPageParse(line)) {
        break;
      }

      if (currentCard === null || shouldSkipLine(line)) {
        continue;
      }

      const transactionMatch = TRANSACTION_LINE_RE.exec(line);
      if (!transactionMatch) {
        const parsedBlock = parseSplitTransaction(lines, index, currentCard);
        if (parsedBlock) {
          transactions.push(parsedBlock.transaction);
          index = parsedBlock.nextIndex;
        }
        continue;
      }

      const description = transactionMatch[2].replace(/\s+/g, " ").trim();
      const amount = parseAmount(transactionMatch[3]);
      const isCredit = Boolean(transactionMatch[4]);
      const isPayment = description.toUpperCase().startsWith(PAYMENT_PREFIX);

      transactions.push({
        cardNumber: currentCard,
        date: transactionMatch[1],
        description,
        amountAud: amount,
        isCredit,
        isPayment,
      });
    }
  }

  return transactions;
}

function parseSplitTransaction(
  lines: string[],
  startIndex: number,
  currentCard: string,
): { transaction: Transaction; nextIndex: number } | null {
  const dateMatch = DATE_ONLY_RE.exec(lines[startIndex]);
  if (!dateMatch?.[1]) {
    return null;
  }

  const amountMatch = AMOUNT_ONLY_RE.exec(lines[startIndex + 1] ?? "");
  if (!amountMatch?.[1]) {
    return null;
  }

  const descriptionParts: string[] = [];
  let index = startIndex + 2;

  while (index < lines.length) {
    const line = lines[index];
    if (
      shouldStopPageParse(line) ||
      shouldSkipLine(line) ||
      TRANSACTION_LINE_RE.test(line) ||
      DATE_ONLY_RE.test(line) ||
      isSplitMainHeader(lines, index) ||
      matchSplitCardHeader(lines, index) !== null
    ) {
      break;
    }

    descriptionParts.push(line);
    index += 1;
  }

  if (descriptionParts.length === 0) {
    return null;
  }

  const description = descriptionParts.join(" ").replace(/\s+/g, " ").trim();
  const amount = parseAmount(amountMatch[1]);
  const isCredit = Boolean(amountMatch[2]);
  const isPayment = description.toUpperCase().startsWith(PAYMENT_PREFIX);

  return {
    transaction: {
      cardNumber: currentCard,
      date: dateMatch[1],
      description,
      amountAud: amount,
      isCredit,
      isPayment,
    },
    nextIndex: index - 1,
  };
}

function isSplitMainHeader(lines: string[], index: number): boolean {
  return (
    lines[index] === "DATE" &&
    lines[index + 1] === "TRANSACTION DETAILS" &&
    lines[index + 2] === "AMOUNT $"
  );
}

function matchSplitCardHeader(lines: string[], index: number): string | null {
  if (
    lines[index] !== "DATE" ||
    lines[index + 1] !== "TRANSACTION DETAILS" ||
    !lines[index + 2]?.startsWith("Card no. XXXX XXXX XXXX ")
  ) {
    return null;
  }

  const cardMatch = /Card no\. XXXX XXXX XXXX (\d{4})/.exec(lines[index + 2] ?? "");
  if (!cardMatch || lines[index + 3] !== "AMOUNT $") {
    return null;
  }

  return cardMatch[1];
}

function shouldStopPageParse(line: string): boolean {
  return (
    line.startsWith("Customer service") ||
    line.startsWith("Closing balance $") ||
    line.startsWith("Continued over page..")
  );
}

function shouldSkipLine(line: string): boolean {
  return (
    ACCOUNT_HEADER_RE.test(line) ||
    line.startsWith("Page ") ||
    REFERENCE_NUMBER_RE.test(line) ||
    FOREIGN_CURRENCY_RE.test(line)
  );
}
