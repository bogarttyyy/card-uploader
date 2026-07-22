import { POST } from "@/app/api/extraction-failures/route";

function createRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/extraction-failures", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.com",
      ...headers,
    },
    body,
  });
}

describe("/api/extraction-failures", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts and logs only an anonymous failure category", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(
      createRequest(JSON.stringify({ stage: "extraction", code: "invalid_pdf" }), {
        "x-vercel-id": "syd1::abc123",
      }),
    );

    expect(response.status).toBe(204);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logPayload = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(logPayload).toMatchObject({
      stage: "extraction",
      code: "invalid_pdf",
    });
    expect(JSON.stringify(logPayload)).not.toMatch(
      /fileName|fileSize|fileLastModified|errorMessage|userAgent|transaction/i,
    );
  });

  it.each([
    ["wrong origin", createRequest("{}", { Origin: "https://attacker.example" }), 403],
    ["wrong content type", createRequest("{}", { "Content-Type": "text/plain" }), 415],
    ["unknown enum", createRequest(JSON.stringify({ stage: "extract", code: "oops" })), 400],
    [
      "extra identifying fields",
      createRequest(JSON.stringify({ stage: "extraction", code: "invalid_pdf", fileName: "secret.pdf" })),
      400,
    ],
    ["oversized request", createRequest("x".repeat(1025)), 413],
  ])("rejects %s", async (_name, request, expectedStatus) => {
    expect((await POST(request as Request)).status).toBe(expectedStatus);
  });
});
