import { NextResponse } from "next/server";
import {
  MAX_EVIDENCE_BYTES,
  MAX_MULTIPART_BODY_BYTES,
  anchorEvidence,
} from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api";
import { acquireAnchorSlot, requireWriteAuthorization } from "~~/lib/provenance/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let releaseSlot: (() => void) | undefined;

  try {
    requireWriteAuthorization(request);

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
      return NextResponse.json(
        { error: "request body exceeds the template limit", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
    }

    releaseSlot = acquireAnchorSlot();

    const formData = await request.formData();
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
