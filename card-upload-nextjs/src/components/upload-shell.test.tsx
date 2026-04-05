import { render, screen } from "@testing-library/react";
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
  };

  beforeEach(() => {
    extractPdfTextMock.mockReset();
    parseStatementFromExtractionMock.mockReset();
  });

  it("shows loading and success details after a valid pdf upload", async () => {
    let resolveExtraction: ((value: Awaited<ReturnType<typeof extractPdfText>>) => void) | null =
      null;
    extractPdfTextMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExtraction = resolve;
        }),
    );

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("status")).toHaveTextContent(/extracting text from pdf/i);

    parseStatementFromExtractionMock.mockReturnValue(parsedStatement);

    resolveExtraction?.({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });

    await screen.findByRole("link", { name: /download combined csv/i });

    expect(screen.getByText("13 April 2026")).toBeInTheDocument();
    expect(screen.getAllByText("$3,053.10").length).toBeGreaterThan(0);
    expect(screen.getByText(/7248, 8489/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download combined csv/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "CSV" })).toHaveLength(2);
    expect(screen.getByRole("combobox")).toHaveValue("7248");
    expect(screen.getByText(/show excluded rows \(1\)/i)).toBeInTheDocument();
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

    await screen.findByRole("link", { name: /download combined csv/i });
    await user.selectOptions(screen.getByRole("combobox"), "8489");

    expect(screen.getByRole("combobox")).toHaveValue("8489");
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
    });

    render(<UploadShell />);
    const user = userEvent.setup();
    const fileInput = screen.getByLabelText(/choose a pdf statement/i);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });

    await user.upload(fileInput, file);

    expect(await screen.findByRole("alert")).toHaveTextContent(/parsed totals do not fully reconcile/i);
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
  });
});
