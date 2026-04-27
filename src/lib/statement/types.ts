export type StatementMetadata = {
  closingBalance: number | null;
  openingBalance: number | null;
  paymentsAndCredits: number | null;
  purchasesTotal: number | null;
  statementPeriodStart: Date | null;
  statementPeriodEnd: Date | null;
  statementFrom: string | null;
  statementTo: string | null;
  minimumDueDate: string | null;
  primaryCard: string | null;
  cardNumbers: string[];
};

export type Transaction = {
  cardNumber: string;
  date: string;
  description: string;
  amountAud: number;
  isCredit: boolean;
  isPayment: boolean;
};

export type CardSummary = {
  cardNumber: string;
  purchases: number;
  credits: number;
  excludedBpay: number;
  netTotal: number;
};

export type ReconciliationRow = {
  item: string;
  statement: number | null;
  parsed: number | null;
  delta: number | null;
};

export type ExportRow = {
  "Card Number": string;
  Date: string;
  Description: string;
  "Amount (AUD)": number;
};
