import path from "node:path";
import { readFileSync } from "node:fs";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction/core";
import {
  buildCardSummary,
  buildReconciliationRows,
  computeBalance,
  getStatementMetadata,
  parseStatementFromExtraction,
  parseTransactionPages,
} from "@/lib/statement";

describe("statement parser", () => {
  it("extracts expected metadata fields from sample text", () => {
    const sampleText = `
Statement period 20/01/26-19/02/26
Closing balance $3,575.18
Minimum payment due date 16/03/26
Opening balance $4,786.66
Payments and credits $4,790.88 CR
Purchases $3,579.40
Account number XXXX XXXX XXXX 7248
Card no. XXXX XXXX XXXX 8489
`;

    const metadata = getStatementMetadata(sampleText);

    expect(metadata.primaryCard).toBe("7248");
    expect(metadata.cardNumbers).toEqual(["7248", "8489"]);
    expect(metadata.minimumDueDate).toBe("16 March 2026");
    expect(metadata.closingBalance).toBe(3575.18);
    expect(metadata.purchasesTotal).toBe(3579.4);
    expect(metadata.paymentsAndCredits).toBe(4790.88);
  });

  it("parses transaction pages while skipping references and foreign currency lines", () => {
    const pageTexts = [
      `Account No. XXXX XXXX XXXX 7248 Statement period 20/01/26-19/02/26
DATE TRANSACTION DETAILS AMOUNT $
Jan 23 OPENAI *CHATGPT SUBSCR OPENAI.COM CA 31.86
24492166034100017590151
US DOLLAR 22.00
Jan 24 BPAY PAYMENT - THANK YOU - 2,692.97 CR
74984166043050019006582
DATE TRANSACTION DETAILS Card no. XXXX XXXX XXXX 8489 AMOUNT $
Feb 14 eBay O*20-14219-98730 Sydney 4.22 CR
74773886045001083297082
Continued over page..`,
    ];

    const transactions = parseTransactionPages(pageTexts, "7248");

    expect(transactions).toHaveLength(3);
    expect(transactions[0].description).toBe("OPENAI *CHATGPT SUBSCR OPENAI.COM CA");
    expect(transactions[0].isCredit).toBe(false);
    expect(transactions[1].isPayment).toBe(true);
    expect(transactions[2].cardNumber).toBe("8489");
    expect(transactions[2].isCredit).toBe(true);
  });

  it("matches expected metadata and totals for the known fixture pdf", async () => {
    const bytes = readFileSync(
      path.resolve(
        process.cwd(),
        "statements/Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
      ),
    );
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const extraction = await extractPdfTextFromBuffer(buffer);

    const parsed = parseStatementFromExtraction(extraction);

    expect(parsed.metadata.minimumDueDate).toBe("16 March 2026");
    expect(parsed.metadata.cardNumbers).toEqual(["7248", "8489"]);
    expect(parsed.metadata.closingBalance).toBe(3575.18);
    expect(computeBalance(parsed.transactions, parsed.metadata.cardNumbers)).toBe(3575.18);

    const actualSummaries = Object.fromEntries(
      buildCardSummary(parsed.transactions, parsed.metadata.cardNumbers).map((row) => [
        row.cardNumber,
        row.netTotal,
      ]),
    );

    expect(actualSummaries).toEqual({
      "7248": 2009.6,
      "8489": 1565.58,
    });
  });

  it("reconciliation deltas are zero for the known fixture pdf", async () => {
    const bytes = readFileSync(
      path.resolve(
        process.cwd(),
        "statements/Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
      ),
    );
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const extraction = await extractPdfTextFromBuffer(buffer);

    const parsed = parseStatementFromExtraction(extraction);
    const deltas = Object.fromEntries(
      buildReconciliationRows(
        parsed.metadata,
        parsed.transactions,
        parsed.metadata.cardNumbers,
      ).map((row) => [row.item, row.delta]),
    );

    expect(Math.abs(deltas.Purchases ?? 0)).toBe(0);
    expect(Math.abs(deltas["Payments and Credits"] ?? 0)).toBe(0);
    expect(Math.abs(deltas["Computed Closing Balance"] ?? 0)).toBe(0);
  });
});
