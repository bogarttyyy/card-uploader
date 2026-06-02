import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("pdf text worker", () => {
  it("uses the legacy PDF.js worker bundle to match the legacy main build", () => {
    const source = readFileSync(join(process.cwd(), "src/workers/pdf-text.worker.ts"), "utf8");

    expect(source).toContain("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
    expect(source).not.toContain("\"pdfjs-dist/build/pdf.worker.min.mjs\"");
  });
});
