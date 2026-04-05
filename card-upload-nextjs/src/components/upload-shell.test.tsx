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

    parseStatementFromExtractionMock.mockReturnValue({
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
      ],
      cardSummary: [
        {
          cardNumber: "7248",
          purchases: 1239.57,
          credits: 0,
          excludedBpay: 2009.6,
          netTotal: 1239.57,
        },
        {
          cardNumber: "8489",
          purchases: 1813.53,
          credits: 0,
          excludedBpay: 0,
          netTotal: 1813.53,
        },
      ],
      reconciliationRows: [],
    });

    resolveExtraction?.({
      pageTexts: ["Statement period 20/01/26-19/02/26"],
      fullText: "Statement period 20/01/26-19/02/26",
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /parsed statement ready/i })).toBeInTheDocument();
    });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
    expect(screen.getByText("13 April 2026")).toBeInTheDocument();
    expect(screen.getByText("$3,053.10")).toBeInTheDocument();
    expect(screen.getByText(/7248, 8489/i)).toBeInTheDocument();
    expect(screen.getByText(/statement period 20\/01\/26-19\/02\/26/i)).toBeInTheDocument();
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
