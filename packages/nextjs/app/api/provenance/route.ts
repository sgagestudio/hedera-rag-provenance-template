import { NextResponse } from "next/server";
import { MAX_EVIDENCE_BYTES, anchorEvidence } from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api-response";
import { assertWriteAuthorized, withWriteCapacity } from "~~/lib/provenance/security";

export const runtime = "nodejs";

function formText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  try {
    assertWriteAuthorized(request);

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

    const result = await withWriteCapacity(() =>
      anchorEvidence({
        bytes: new Uint8Array(file.arrayBuffer ? await file.arrayBuffer() : new ArrayBuffer(0)),
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
