import { fireEvent, render, screen } from "@testing-library/react";
import { CsvDownload } from "@/components/csv-download";

describe("CsvDownload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads a UTF-8 BOM Blob and promptly revokes its URL", () => {
    vi.useFakeTimers();
    let blobParts: BlobPart[] = [];
    class CapturedBlob {
      constructor(parts: BlobPart[]) {
        blobParts = parts;
      }
    }
    const createObjectURL = vi.fn(() => "blob:pampi-csv");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("Blob", CapturedBlob);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <CsvDownload csvData={"Card Number\n0042"} fileName="cards.csv">
        Download
      </CsvDownload>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(blobParts).toEqual(["\uFEFF", "Card Number\n0042"]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pampi-csv");
  });
});
