import {
  PdfExtractionError,
  extractPdfText,
  validatePdfFile,
} from "@/lib/pdf-extraction";

describe("pdf extraction contracts", () => {
  it("rejects unsupported files before creating a worker", () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    expect(() => validatePdfFile(file)).toThrowError(PdfExtractionError);
    expect(() => validatePdfFile(file)).toThrow("Please upload a PDF statement");
  });

  it("rejects when workers are unavailable", async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error test override
    globalThis.Worker = undefined;

    try {
      const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "statement.pdf", {
        type: "application/pdf",
      });

      await expect(extractPdfText(file)).rejects.toMatchObject({
        code: "worker_unavailable",
      });
    } finally {
      globalThis.Worker = originalWorker;
    }
  });
});
