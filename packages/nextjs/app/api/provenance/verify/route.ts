import { NextResponse } from "next/server";
import { verifyEvidence } from "~~/lib/provenance";
import { provenanceErrorResponse } from "~~/lib/provenance/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const cid = new URL(request.url).searchParams.get("cid")?.trim();
    if (!cid) {
      return NextResponse.json({ error: "cid is required", code: "INVALID_INPUT" }, { status: 400 });
    }

    const result = await verifyEvidence(cid);
    return NextResponse.json(result, {
      status: result.verified ? 200 : 404,
      headers: {
        "Cache-Control": result.verified
          ? "public, max-age=60, stale-while-revalidate=300"
          : "no-store",
      },
    });
  } catch (error) {
    return provenanceErrorResponse(error, "verify", "Unable to verify evidence.");
  }
}
