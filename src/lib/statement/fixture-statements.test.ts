import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction/core";
import { parseStatementFromExtraction } from "@/lib/statement";

describe("committed statement fixtures", () => {
  it("locks metadata, transaction counts, card totals, and reconciliation", async () => {
    const fixtureDirectory = path.resolve(process.cwd(), "statements");
    const files = readdirSync(fixtureDirectory).filter((file) => file.endsWith(".pdf")).sort();
    const results = [];

    for (const file of files) {
      const bytes = readFileSync(path.join(fixtureDirectory, file));
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const parsed = parseStatementFromExtraction(await extractPdfTextFromBuffer(buffer));

      results.push({
        file,
        period: [parsed.metadata.statementFrom, parsed.metadata.statementTo],
        closingBalance: parsed.metadata.closingBalance,
        transactionCount: parsed.transactions.length,
        cardTotals: Object.fromEntries(
          parsed.cardSummary.map((card) => [card.cardNumber, card.netTotal]),
        ),
        requiredDeltas: Object.fromEntries(
          parsed.reconciliationRows
            .filter((row) =>
              ["Purchases", "Payments and Credits", "Computed Closing Balance"].includes(
                row.item,
              ),
            )
            .map((row) => [row.item, row.delta]),
        ),
        isExportReady: parsed.validation.isExportReady,
      });
    }

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "cardTotals": {
            "7248": 2418.1,
            "8489": 1559.23,
          },
          "closingBalance": 3977.33,
          "file": "Statement_CRD2888bcbaa7bc92c405872016ea1b17c3193148c700ac56a08a.pdf",
          "isExportReady": true,
          "period": [
            "20 September 2025",
            "20 October 2025",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": 0,
            "Payments and Credits": -0,
            "Purchases": 0,
          },
          "transactionCount": 39,
        },
        {
          "cardTotals": {
            "7248": 2339.79,
            "8489": 2248.43,
          },
          "closingBalance": 4588.22,
          "file": "Statement_CRD85678a7c0dc4a5239c52c7dc5b6be4543b945275b2c74e4ed5.pdf",
          "isExportReady": true,
          "period": [
            "21 October 2025",
            "19 November 2025",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": -0,
            "Payments and Credits": 0,
            "Purchases": -0,
          },
          "transactionCount": 72,
        },
        {
          "cardTotals": {
            "7248": 2093.69,
            "8489": 2692.97,
          },
          "closingBalance": 4786.66,
          "file": "Statement_CRDa949855fdeccc94518f2ed877c654f544c52013675f284edf2.pdf",
          "isExportReady": true,
          "period": [
            "20 December 2025",
            "19 January 2026",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": 0,
            "Payments and Credits": 0,
            "Purchases": 0,
          },
          "transactionCount": 65,
        },
        {
          "cardTotals": {
            "7248": 4849.01,
            "8489": 2184.78,
          },
          "closingBalance": 7033.79,
          "file": "Statement_CRDb9e61f2d3f709a3cfd2469c3c0563fe3a8ddc7c0cd93d634c2.pdf",
          "isExportReady": true,
          "period": [
            "21 April 2026",
            "19 May 2026",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": 0,
            "Payments and Credits": 0,
            "Purchases": 0,
          },
          "transactionCount": 71,
        },
        {
          "cardTotals": {
            "7248": 999.66,
            "8489": 4323.55,
          },
          "closingBalance": 5323.21,
          "file": "Statement_CRDd8abc3f468af07377c2867bd15418f734afeca244f8b9e685d.pdf",
          "isExportReady": true,
          "period": [
            "20 March 2026",
            "20 April 2026",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": -0,
            "Payments and Credits": 0,
            "Purchases": 0,
          },
          "transactionCount": 42,
        },
        {
          "cardTotals": {
            "7248": 2009.6,
            "8489": 1565.58,
          },
          "closingBalance": 3575.18,
          "file": "Statement_CRDf6412efd4bd3894627eb4c658e86df2457df654268874e6d59.pdf",
          "isExportReady": true,
          "period": [
            "20 January 2026",
            "19 February 2026",
          ],
          "requiredDeltas": {
            "Computed Closing Balance": -0,
            "Payments and Credits": 0,
            "Purchases": -0,
          },
          "transactionCount": 46,
        },
      ]
    `);
  });
});
