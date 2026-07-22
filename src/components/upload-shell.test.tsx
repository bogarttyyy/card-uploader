import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadShell } from "@/components/upload-shell";
import { PdfExtractionError, extractPdfText } from "@/lib/pdf-extraction";
import { parseStatementFromExtraction } from "@/lib/statement";

vi.mock("@/lib/pdf-extraction", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pdf-extraction")>(
    "@/lib/pdf-extraction",
  );

  return {
    ...actual,
    extractPdfText: vi.fn(),
  };
});

vi.mock("@/lib/statement", async () => {
  const actual = await vi.importActual<typeof import("@/lib/statement")>("@/lib/statement");

  return {
    ...actual,
    parseStatementFromExtraction: vi.fn(),
  };
});

const extractPdfTextMock = vi.mocked(extractPdfText);
const parseStatementFromExtractionMock = vi.mocked(parseStatementFromExtraction);

describe("UploadShell", () => {
  const parsedStatement = {
    metadata: {
      closingBalance: 3053.1,
      openingBalance: 3575.18,
      paymentsAndCredits: 3590.08,
      purchasesTotal: 3068,
      statementPeriodStart: new Date(Date.UTC(2026, 1, 20)),
      statementPeriodEnd: new Date(Date.UTC(2026, 2, 19)),
      statementFrom: "20 February 2026",
      statementTo: "19 March 2026",
      minimumDueDate: "13 April 2026",
      primaryCard: "7248",
      cardNumbers: ["7248", "8489"],
    },
    transactions: [
      {
        cardNumber: "7248",
        date: "Feb 20",
        description: "Amazon",
        amountAud: 29.99,
        isCredit: false,
        isPayment: false,
      },
      {
        cardNumber: "7248",
        date: "Mar 13",
        description: "BPAY PAYMENT - THANK YOU -",
        amountAud: 2009.6,
        isCredit: true,
        isPayment: true,
      },
      {
        cardNumber: "8489",
        date: "Mar 14",
        description: "eBay O*20-14219-98730 Sydney",
        amountAud: 4.22,
        isCredit: true,
        isPayment: false,
      },
    ],
    cardSummary: [
      {
        cardNumber: "7248",
        purchases: 3249.17,
        credits: 0,
        excludedBpay: 2009.6,
        netTotal: 1239.57,
      },
      {
        cardNumber: "8489",
        purchases: 1817.75,
        credits: 4.22,
        excludedBpay: 0,
        netTotal: 1813.53,
      },
    ],
    reconciliationRows: [
      { item: "Opening Balance", statement: 3575.18, parsed: 3575.18, delta: 0 },
      { item: "Purchases", statement: 3068, parsed: 3068, delta: 0 },
      { item: "Payments and Credits", statement: 3590.08, parsed: 3590.08, delta: 0 },
      { item: "Closing Balance", statement: 3053.1, parsed: 3053.1, delta: 0 },
      { item: "Computed Closing Balance", statement: 3053.1, parsed: 3053.1, delta: 0 },
    ],
    validation: {
      issues: [],
      warnings: [],
      isExportReady: true,
    },
  };

  beforeEach(() => {
    extractPdfTextMock.mockReset();
    parseStatementFromExtractionMock.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-csv"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading and success details after a valid pdf upload", async () => {
    const extraction = Promise.withResolvers<Awaited<ReturnType<typeof extractPdfText>>>();
    extractPdfTextMock.mockReturnValue(extraction.promise);

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("status")).toHaveTextContent(/extracting text from pdf/i);

    parseStatementFromExtractionMock.mockReturnValue(parsedStatement);

    extraction.resolve({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });

    await screen.findByRole("button", { name: /download combined csv/i });

    expect(screen.getByText("13 April 2026")).toBeInTheDocument();
    expect(screen.getAllByText("$3,053.10").length).toBeGreaterThan(0);
    expect(screen.getByText(/7248, 8489/i)).toBeInTheDocument();
    expect(screen.getByText(/exportable rows/i)).toBeInTheDocument();
    const combinedCsvButton = screen.getByRole("button", { name: /download combined csv/i });
    await user.click(combinedCsvButton);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /download card 7248 csv from summary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download selected card 7248 csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download card 8489 csv from summary/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("7248");
    expect(screen.getByText(/show excluded rows \(1\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw page text debug snapshot/i)).not.toBeInTheDocument();
  });

  it("cancels active extraction when reset before allowing another upload", async () => {
    const signals: AbortSignal[] = [];
    extractPdfTextMock.mockImplementation((_file, options) => {
      if (options?.signal) {
        signals.push(options.signal);
      }
      return new Promise(() => {});
    });

    render(<UploadShell />);
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText(/choose a pdf statement/i),
      new File(["%PDF-1.4"], "first.pdf", { type: "application/pdf" }),
    );
    await screen.findByText(/extracting text from pdf/i);
    expect(screen.getByLabelText(/choose a pdf statement/i)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /upload new statement/i }));
    expect(signals[0].aborted).toBe(true);
    expect(screen.getByLabelText(/choose a pdf statement/i)).toBeEnabled();

    await user.upload(
      screen.getByLabelText(/choose a pdf statement/i),
      new File(["%PDF-1.4"], "second.pdf", { type: "application/pdf" }),
    );
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
  });

  it("switches cards and updates the transaction view", async () => {
    extractPdfTextMock.mockResolvedValue({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });
    parseStatementFromExtractionMock.mockReturnValue(parsedStatement);

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    await screen.findByRole("button", { name: /download combined csv/i });
    await user.selectOptions(screen.getByRole("combobox"), "8489");

    expect(screen.getByRole("combobox")).toHaveValue("8489");
    expect(screen.getByRole("button", { name: /download selected card 8489 csv/i })).toBeInTheDocument();
    expect(screen.getByText("eBay O*20-14219-98730 Sydney")).toBeInTheDocument();
    expect(screen.queryByText(/show excluded rows \(1\)/i)).not.toBeInTheDocument();
  });

  it("shows the reconciliation warning when parsed totals mismatch", async () => {
    extractPdfTextMock.mockResolvedValue({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });
    parseStatementFromExtractionMock.mockReturnValue({
      ...parsedStatement,
      reconciliationRows: parsedStatement.reconciliationRows.map((row) =>
        row.item === "Computed Closing Balance" ? { ...row, delta: 1.23 } : row,
      ),
      validation: {
        issues: [
          {
            code: "reconciliation_mismatch",
            message: "Computed Closing Balance differs from the statement by +$1.23.",
          },
        ],
        warnings: [],
        isExportReady: false,
      },
    });

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(/computed closing balance differs/i);
    expect(screen.queryByRole("button", { name: /download combined csv/i })).not.toBeInTheDocument();
  });

  it("shows a parse failure when extracted text cannot be turned into a supported statement", async () => {
    extractPdfTextMock.mockResolvedValue({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });
    parseStatementFromExtractionMock.mockImplementation(() => {
      throw new Error("invalid statement format");
    });

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(/parsing failed/i);
    expect(screen.getByText(/could not be parsed into the supported format/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/extraction-failures",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ stage: "parsing", code: "parsing_failed" }),
        }),
      );
    });
  });

  it("reports extraction failures to the server for Vercel logging", async () => {
    extractPdfTextMock.mockRejectedValue(
      new PdfExtractionError("extraction_failed", "The PDF extraction worker failed."),
    );

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", {
      type: "application/pdf",
      lastModified: 1772452800000,
    });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(/extraction failed/i);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/extraction-failures",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stage: "extraction", code: "extraction_failed" }),
          keepalive: true,
        }),
      );
    });
  });

  it("blocks exports when required statement details are missing", async () => {
    extractPdfTextMock.mockResolvedValue({
      pageTexts: ["statement text"],
      fullText: "statement text",
    });
    parseStatementFromExtractionMock.mockReturnValue({
      ...parsedStatement,
      metadata: {
        ...parsedStatement.metadata,
        primaryCard: null,
        cardNumbers: [],
      },
      transactions: [],
      cardSummary: [],
      validation: {
        issues: [
          { code: "missing_primary_card", message: "Primary card could not be identified from the statement header." },
          { code: "missing_card_numbers", message: "No card numbers were detected in the statement." },
          { code: "missing_transactions", message: "No valid transactions were found in the statement activity pages." },
        ],
        warnings: [],
        isExportReady: false,
      },
    });

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByText(/this statement is not ready for export yet/i)).toBeInTheDocument();
    expect(screen.getByText(/primary card could not be identified/i)).toBeInTheDocument();
    expect(screen.getByText(/no card numbers were detected/i)).toBeInTheDocument();
    expect(screen.getByText(/no valid transactions were found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download combined csv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a user-facing error for unsupported files", async () => {
    extractPdfTextMock.mockRejectedValue(
      new PdfExtractionError(
        "unsupported_file",
        "Please upload a PDF statement. Other file types are not supported.",
      ),
    );

    render(<UploadShell />);
    const user = userEvent.setup({ applyAccept: false });
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["plain text"], "notes.txt", { type: "text/plain" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /please upload a pdf statement/i,
    );
    expect(screen.getByText(/selected file: notes\.txt \(unsupported file\)/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
