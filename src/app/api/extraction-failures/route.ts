const MAX_REQUEST_BYTES = 1024;
const STAGES = new Set(["extraction", "parsing"]);
const CODES = new Set([
  "unsupported_file",
  "file_too_large",
  "invalid_pdf",
  "aborted",
  "worker_unavailable",
  "extraction_failed",
  "parsing_failed",
]);

export async function POST(request: Request) {
  const start = Date.now();

  try {
    if (!hasValidOrigin(request)) {
      return new Response(null, { status: 403 });
    }
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
      return new Response(null, { status: 415 });
    }

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return new Response(null, { status: 413 });
    }

    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
      return new Response(null, { status: 413 });
    }

    const payload = JSON.parse(body) as unknown;
    if (!isValidPayload(payload)) {
      return new Response(null, { status: 400 });
    }

    const logPayload = {
      level: "error",
      msg: "pdf_extraction_failed",
      route: "/api/extraction-failures",
      requestId: request.headers.get("x-vercel-id"),
      stage: payload.stage,
      code: payload.code,
      ms: Date.now() - start,
    };

    console.error(JSON.stringify(logPayload));

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}

function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

function isValidPayload(
  payload: unknown,
): payload is { stage: string; code: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);

  return (
    keys.length === 2 &&
    keys.includes("stage") &&
    keys.includes("code") &&
    typeof record.stage === "string" &&
    typeof record.code === "string" &&
    STAGES.has(record.stage) &&
    CODES.has(record.code)
  );
}
