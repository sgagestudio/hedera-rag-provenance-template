import { NextResponse } from "next/server";
import { publicApiError } from "~~/lib/provenance/api";
import { verifyEvidence } from "~~/lib/provenance";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const cid = searchParams.get("cid")?.trim();
    if (!cid) return NextResponse.json({ error: "cid is required" }, { status: 400 });

    const rawSequence = searchParams.get("sequence")?.trim();
    const sequence = rawSequence ? Number(rawSequence) : null;

    const result = await verifyEvidence(cid, sequence);
    return NextResponse.json(result, { status: result.verified ? 200 : 404 });
  } catch (error) {
    const apiError = publicApiError(error, "Unable to verify evidence.");
    return NextResponse.json({ error: apiError.message }, { status: apiError.status });
  }
}
