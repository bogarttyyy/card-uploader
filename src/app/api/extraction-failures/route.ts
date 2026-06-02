type ExtractionFailurePayload = {
  stage?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  fileType?: unknown;
  fileLastModified?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
  userAgent?: unknown;
};

const MAX_STRING_LENGTH = 500;

export async function POST(request: Request) {
  const start = Date.now();

  try {
    const payload = (await request.json()) as ExtractionFailurePayload;
    const logPayload = {
      level: "error",
      msg: "pdf_extraction_failed",
      route: "/api/extraction-failures",
      requestId: request.headers.get("x-vercel-id"),
      stage: toStringValue(payload.stage),
      fileName: toStringValue(payload.fileName),
      fileSize: toNumberValue(payload.fileSize),
      fileType: toStringValue(payload.fileType),
      fileLastModified: toNumberValue(payload.fileLastModified),
      errorCode: toStringValue(payload.errorCode),
      errorMessage: toStringValue(payload.errorMessage),
      userAgent: toStringValue(payload.userAgent),
      ms: Date.now() - start,
    };

    console.error(JSON.stringify(logPayload));

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "pdf_extraction_failure_log_failed",
        route: "/api/extraction-failures",
        requestId: request.headers.get("x-vercel-id"),
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - start,
      }),
    );

    return Response.json({ ok: false }, { status: 400 });
  }
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.slice(0, MAX_STRING_LENGTH);
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}
