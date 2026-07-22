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

export type StatementValidationIssueCode =
  | "missing_statement_period"
  | "missing_balances"
  | "missing_purchases_total"
  | "missing_payments_and_credits_total"
  | "missing_primary_card"
  | "missing_card_numbers"
  | "missing_transactions"
  | "unknown_transaction_card"
  | "missing_reconciliation_delta"
  | "reconciliation_mismatch";

export type StatementValidationWarningCode = "missing_due_date";

export type StatementValidationIssue = {
  code: StatementValidationIssueCode;
  message: string;
};

export type StatementValidationWarning = {
  code: StatementValidationWarningCode;
  message: string;
};

export type StatementValidation = {
  issues: StatementValidationIssue[];
  warnings: StatementValidationWarning[];
  isExportReady: boolean;
};
