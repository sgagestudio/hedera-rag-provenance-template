import { NextResponse } from "next/server";
import { ProvenanceError } from "./errors";

function safeServerLog(context: string, error: unknown): void {
  if (error instanceof ProvenanceError) {
    console.error("[provenance]", { context, code: error.code, status: error.status });
    return;
  }
  console.error("[provenance]", {
    context,
    name: error instanceof Error ? error.name : "UnknownError",
  });
}

export function provenanceErrorResponse(error: unknown, context: string, fallbackMessage: string) {
  safeServerLog(context, error);

  if (error instanceof ProvenanceError) {
    return NextResponse.json(
      {
        error: error.expose ? error.message : fallbackMessage,
        code: error.code,
      },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.code === "UNAUTHORIZED" ? { "WWW-Authenticate": "Bearer" } : {}),
        },
      },
    );
  }

  return NextResponse.json(
    { error: fallbackMessage, code: "INTERNAL_ERROR" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
