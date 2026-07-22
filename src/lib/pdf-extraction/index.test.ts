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
      const file = new File(["%PDF-1.4"], "statement.pdf", {
        type: "application/pdf",
      });

      await expect(extractPdfText(file)).rejects.toMatchObject({
        code: "worker_unavailable",
      });
    } finally {
      globalThis.Worker = originalWorker;
    }
  });

  it("accepts a missing iPhone MIME type when the filename is a PDF", () => {
    expect(() => validatePdfFile(new File(["%PDF-"], "statement.PDF"))).not.toThrow();
  });

  it("rejects oversized files before reading or starting a worker", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "statement.pdf", {
      type: "application/pdf",
    });

    await expect(extractPdfText(file)).rejects.toMatchObject({ code: "file_too_large" });
  });

  it("rejects a renamed non-PDF using its file signature", async () => {
    const file = new File(["not really a pdf"], "statement.pdf", {
      type: "application/pdf",
    });

    await expect(extractPdfText(file)).rejects.toMatchObject({ code: "invalid_pdf" });
  });

  it("honours cancellation before reading the file", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = new File(["%PDF-1.4"], "statement.pdf", {
      type: "application/pdf",
    });

    await expect(extractPdfText(file, { signal: controller.signal })).rejects.toMatchObject({
      code: "aborted",
    });
  });
});
