import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfTextFromBuffer } from "@/lib/pdf-extraction/core";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
}));

const getDocumentMock = vi.mocked(getDocument);

describe("pdf extraction core", () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
  });

  it("reads page text through stream readers instead of PDF.js async stream iteration", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: {
          items: [
            {
              str: "Hello",
              transform: [1, 0, 0, 1, 10, 1],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        done: false,
        value: {
          items: [
            {
              str: "World",
              transform: [1, 0, 0, 1, 60, 1],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        done: true,
        value: undefined,
      });
    const releaseLock = vi.fn();
    const getTextContent = vi.fn();
    const streamTextContent = vi.fn(() => ({
      getReader: () => ({
        read,
        releaseLock,
      }),
    }));

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent,
          streamTextContent,
        }),
      }),
    } as ReturnType<typeof getDocument>);

    await expect(extractPdfTextFromBuffer(new ArrayBuffer(1))).resolves.toEqual({
      pageTexts: ["Hello World"],
      fullText: "Hello World",
    });
    expect(streamTextContent).toHaveBeenCalledTimes(1);
    expect(getTextContent).not.toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });
});
