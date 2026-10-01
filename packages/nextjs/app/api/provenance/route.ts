import { NextResponse } from "next/server";
import { MAX_EVIDENCE_BYTES, MAX_MULTIPART_BODY_BYTES, anchorEvidence } from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api";
import { payloadTooLarge } from "~~/lib/provenance/errors";
import { acquireAnchorSlot, requireWriteAuthorization } from "~~/lib/provenance/security";

export const runtime = "nodejs";

async function readRequestBodyWithLimit(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw payloadTooLarge("Request body exceeds the template limit.");
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge("Request body exceeds the template limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request) {
  let releaseSlot: (() => void) | undefined;

  try {
    requireWriteAuthorization(request);
    releaseSlot = acquireAnchorSlot();

    const body = await readRequestBodyWithLimit(request, MAX_MULTIPART_BODY_BYTES);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body,
    });
    const formData = await boundedRequest.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required", code: "INVALID_INPUT" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "file is empty", code: "INVALID_INPUT" }, { status: 400 });
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      return NextResponse.json(
        { error: "file exceeds the 5 MiB template limit", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }

    const result = await anchorEvidence({
      bytes: new Uint8Array(await file.arrayBuffer()),
      sourceUri: String(formData.get("sourceUri") || ""),
      title: String(formData.get("title") || file.name),
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return provenanceErrorResponse(error, "anchor", "Unable to anchor evidence.");
  } finally {
    releaseSlot?.();
  }
}
