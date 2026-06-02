import { POST } from "@/app/api/extraction-failures/route";

describe("/api/extraction-failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs sanitized extraction failure details for Vercel runtime logs", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("https://example.com/api/extraction-failures", {
        method: "POST",
        headers: {
          "x-vercel-id": "syd1::abc123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stage: "extraction",
          fileName: "statement.pdf",
          fileSize: 12345,
          fileType: "application/pdf",
          fileLastModified: 1772452800000,
          errorCode: "extraction_failed",
          errorMessage: "Could not parse PDF",
          userAgent: "Vitest",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

    const logPayload = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(logPayload).toMatchObject({
      level: "error",
      msg: "pdf_extraction_failed",
      route: "/api/extraction-failures",
      requestId: "syd1::abc123",
      stage: "extraction",
      fileName: "statement.pdf",
      fileSize: 12345,
      fileType: "application/pdf",
      errorCode: "extraction_failed",
      errorMessage: "Could not parse PDF",
      userAgent: "Vitest",
    });
    expect(logPayload.ms).toEqual(expect.any(Number));
  });
});
