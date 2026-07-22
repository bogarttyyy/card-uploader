import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction/core";
import { parseStatementFromExtraction } from "@/lib/statement";

const fixtureDirectory = path.resolve(
  process.env.STATEMENT_FIXTURE_DIRECTORY ?? path.join(process.cwd(), "statements"),
);
const localFixtureIt = existsSync(fixtureDirectory) ? it : it.skip;

describe("local statement fixtures", () => {
  localFixtureIt("parses and reconciles every available PDF", async () => {
    const files = readdirSync(fixtureDirectory).filter((file) => file.endsWith(".pdf")).sort();

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const bytes = readFileSync(path.join(fixtureDirectory, file));
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const parsed = parseStatementFromExtraction(await extractPdfTextFromBuffer(buffer));
      const requiredDeltas = parsed.reconciliationRows
        .filter((row) =>
          ["Purchases", "Payments and Credits", "Computed Closing Balance"].includes(row.item),
        )
        .map((row) => row.delta);

      expect(parsed.metadata.statementPeriodStart, file).not.toBeNull();
      expect(parsed.metadata.statementPeriodEnd, file).not.toBeNull();
      expect(parsed.metadata.closingBalance, file).not.toBeNull();
      expect(parsed.transactions.length, file).toBeGreaterThan(0);
      expect(parsed.cardSummary.length, file).toBeGreaterThan(0);
      expect(requiredDeltas, file).toHaveLength(3);
      expect(requiredDeltas.every((delta) => Object.is(delta, -0) || delta === 0), file).toBe(true);
      expect(parsed.validation.isExportReady, file).toBe(true);
    }
  });
});
