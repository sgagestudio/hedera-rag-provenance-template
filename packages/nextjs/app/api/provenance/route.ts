import { NextResponse } from "next/server";
import { MAX_EVIDENCE_BYTES, anchorEvidence } from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api-response";
import { assertWriteAuthorized, withWriteCapacity } from "~~/lib/provenance/security";

export const runtime = "nodejs";

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

function formText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  try {
    assertWriteAuthorized(request);

    const contentLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_EVIDENCE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
    ) {
      return NextResponse.json(
        { error: "request body exceeds the provenance upload limit", code: "INVALID_INPUT" },
        { status: 413 },
      );
    }

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
        { error: "file exceeds the 5 MiB template limit", code: "INVALID_INPUT" },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await withWriteCapacity(() =>
      anchorEvidence({
        bytes,
        sourceUri: formText(formData, "sourceUri"),
        title: formText(formData, "title") || file.name,
        mimeType: file.type || "application/octet-stream",
      }),
    );

    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return provenanceErrorResponse(error, "anchor");
  }
}
