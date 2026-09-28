import { NextResponse } from "next/server";
import { assertRequestSize, assertWriteAccess, publicApiError } from "~~/lib/provenance/api";
import { MAX_EVIDENCE_BYTES, anchorEvidence } from "~~/lib/provenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertWriteAccess(request);
    assertRequestSize(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "file is empty" }, { status: 400 });
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      return NextResponse.json({ error: "file exceeds the 5 MiB template limit" }, { status: 413 });
    }

    const result = await anchorEvidence({
      bytes: new Uint8Array(await file.arrayBuffer()),
      sourceUri: String(formData.get("sourceUri") || ""),
      title: String(formData.get("title") || file.name),
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const apiError = publicApiError(error, "Unable to anchor evidence.");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
