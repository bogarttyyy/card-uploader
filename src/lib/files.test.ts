import { getAcceptedFileTypes, isPdfFileName } from "@/lib/files";

describe("file helpers", () => {
  it("returns the accepted file types string for the upload input", () => {
    expect(getAcceptedFileTypes()).toBe(".pdf");
  });

  it("recognizes pdf file names regardless of case", () => {
    expect(isPdfFileName("statement.PDF")).toBe(true);
    expect(isPdfFileName("statement.txt")).toBe(false);
  });
});
