import { NextResponse } from "next/server";
import { verifyEvidence } from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api-response";
import { ValidationError } from "~~/lib/provenance/errors";

export const runtime = "nodejs";

function parseSequenceNumber(value: string | null): number | null {
  if (!value) return null;
  if (!/^[1-9]\d*$/.test(value)) throw new ValidationError("sequenceNumber must be a positive integer.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ValidationError("sequenceNumber is too large.");
  return parsed;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const cid = params.get("cid")?.trim();
    if (!cid) {
      return NextResponse.json({ error: "cid is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const result = await verifyEvidence(cid, parseSequenceNumber(params.get("sequenceNumber")));
    return NextResponse.json(result, {
      status: result.verified ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return provenanceErrorResponse(error, "verify");
  }
}
