import {
  buildCardSummary,
  buildCsvData,
  buildReconciliationRows,
  computeBalance,
  computeCardTotal,
  formatStatementDate,
  getExcludedTransactionsForCard,
  getTransactionsForCard,
  normalizeTransactionDate,
  parseAmount,
  parseStatementPeriodDate,
  transactionsToExportRows,
} from "@/lib/statement";
import type { ExportRow, StatementMetadata, Transaction } from "@/lib/statement";

function createMetadata(overrides: Partial<StatementMetadata> = {}): StatementMetadata {
  return {
    closingBalance: null,
    openingBalance: null,
    paymentsAndCredits: null,
    purchasesTotal: null,
    statementPeriodStart: new Date(Date.UTC(2026, 0, 20)),
    statementPeriodEnd: new Date(Date.UTC(2026, 1, 19)),
    statementFrom: "20 January 2026",
    statementTo: "19 February 2026",
    minimumDueDate: null,
    primaryCard: null,
    cardNumbers: [],
    ...overrides,
  };
}

describe("statement core", () => {
  it("parses amounts and formats statement dates", () => {
    expect(parseAmount("4,786.66")).toBe(4786.66);
    expect(formatStatementDate("16/03/26")).toBe("16 March 2026");
    expect(formatStatementDate(null)).toBeNull();
    expect(parseStatementPeriodDate("20/01/26")?.toISOString()).toBe("2026-01-20T00:00:00.000Z");
    expect(parseStatementPeriodDate(null)).toBeNull();
  });

  it("normalizes year-boundary transaction dates", () => {
    const metadata = createMetadata({
      statementPeriodStart: new Date(Date.UTC(2025, 11, 20)),
      statementPeriodEnd: new Date(Date.UTC(2026, 0, 19)),
      statementFrom: "20 December 2025",
      statementTo: "19 January 2026",
      primaryCard: "7248",
      cardNumbers: ["7248"],
    });

    expect(normalizeTransactionDate("Dec 31", metadata)).toBe("2025-12-31");
    expect(normalizeTransactionDate("Jan 01", metadata)).toBe("2026-01-01");
  });

  it("builds reconciliation rows for synthetic transactions with zero deltas", () => {
    const metadata = createMetadata({
      closingBalance: 80,
      openingBalance: 100,
      paymentsAndCredits: 70,
      purchasesTotal: 50,
      primaryCard: "7248",
      cardNumbers: ["7248"],
    });
    const transactions: Transaction[] = [
      {
        cardNumber: "7248",
        date: "Jan 21",
        description: "Merchant A",
        amountAud: 50,
        isCredit: false,
        isPayment: false,
      },
      {
        cardNumber: "7248",
        date: "Jan 22",
        description: "Refund",
        amountAud: 20,
        isCredit: true,
        isPayment: false,
      },
      {
        cardNumber: "7248",
        date: "Jan 23",
        description: "BPAY PAYMENT - THANK YOU -",
        amountAud: 50,
        isCredit: true,
        isPayment: true,
      },
    ];

    const rows = buildReconciliationRows(metadata, transactions, metadata.cardNumbers);
    const deltas = Object.fromEntries(rows.map((row) => [row.item, row.delta]));

    expect(deltas.Purchases).toBe(0);
    expect(deltas["Payments and Credits"]).toBe(0);
    expect(deltas["Computed Closing Balance"]).toBe(0);
  });

  it("returns empty export rows for no transactions", () => {
    const metadata = createMetadata();
    expect(transactionsToExportRows([], metadata)).toEqual([]);
    expect(buildCsvData([])).toBe("");
  });

  it("filters transactions by card and excludes BPAY payments upstream", () => {
    const transactions: Transaction[] = [
      {
        cardNumber: "7248",
        date: "Jan 21",
        description: "Merchant A",
        amountAud: 50,
        isCredit: false,
        isPayment: false,
      },
      {
        cardNumber: "7248",
        date: "Jan 23",
        description: "BPAY PAYMENT - THANK YOU -",
        amountAud: 50,
        isCredit: true,
        isPayment: true,
      },
      {
        cardNumber: "8489",
        date: "Jan 24",
        description: "Merchant B",
        amountAud: 25,
        isCredit: false,
        isPayment: false,
      },
    ];

    expect(getTransactionsForCard(transactions, "7248")).toHaveLength(1);
    expect(getExcludedTransactionsForCard(transactions, "7248")).toHaveLength(1);
    expect(computeCardTotal(transactions, "7248")).toBe(50);
    expect(computeBalance(transactions, ["7248", "8489"])).toBe(75);

    const summaries = buildCardSummary(transactions, ["7248", "8489"]);
    expect(summaries).toEqual([
      {
        cardNumber: "7248",
        purchases: 50,
        credits: 0,
        excludedBpay: 50,
        netTotal: 50,
      },
      {
        cardNumber: "8489",
        purchases: 25,
        credits: 0,
        excludedBpay: 0,
        netTotal: 25,
      },
    ]);
  });

  it("exports credits as negative values and preserves both card numbers", () => {
    const metadata = createMetadata({
      cardNumbers: ["7248", "8489"],
    });
    const transactions: Transaction[] = [
      {
        cardNumber: "7248",
        date: "Jan 21",
        description: "Merchant A",
        amountAud: 50,
        isCredit: false,
        isPayment: false,
      },
      {
        cardNumber: "8489",
        date: "Feb 14",
        description: 'eBay, "Refund"',
        amountAud: 4.22,
        isCredit: true,
        isPayment: false,
      },
    ];

    const exportRows = transactionsToExportRows(transactions, metadata);
    expect(exportRows).toEqual<ExportRow[]>([
      {
        "Card Number": "7248",
        Date: "2026-01-21",
        Description: "Merchant A",
        "Amount (AUD)": 50,
      },
      {
        "Card Number": "8489",
        Date: "2026-02-14",
        Description: 'eBay, "Refund"',
        "Amount (AUD)": -4.22,
      },
    ]);

    const csvData = buildCsvData(exportRows);
    expect(csvData).toContain("Card Number,Date,Description,Amount (AUD)");
    expect(csvData).toContain('7248,2026-01-21,Merchant A,50');
    expect(csvData).toContain('8489,2026-02-14,"eBay, ""Refund""",-4.22');
  });
});
