import { NextResponse } from "next/server";

import { verifyEvidence } from "~~/lib/provenance";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const cid = new URL(request.url).searchParams.get("cid")?.trim();
    if (!cid) return NextResponse.json({ error: "cid is required" }, { status: 400 });

    const result = await verifyEvidence(cid);
    return NextResponse.json(result, { status: result.verified ? 200 : 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify evidence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
