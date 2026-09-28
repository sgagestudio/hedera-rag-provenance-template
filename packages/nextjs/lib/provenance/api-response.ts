import { NextResponse } from "next/server";
import {
  AuthenticationError,
  CapacityError,
  ConfigurationError,
  UpstreamError,
  ValidationError,
} from "./errors";

export function provenanceErrorResponse(error: unknown, operation: string): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message, code: "INVALID_INPUT" }, { status: 400 });
  }
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: "Write API key is missing or invalid.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  if (error instanceof CapacityError) {
    return NextResponse.json(
      { error: error.message, code: "WRITE_CAPACITY_EXCEEDED" },
      { status: 429, headers: { "Retry-After": "2" } },
    );
  }

  console.error(`[provenance:${operation}]`, error);

  if (error instanceof ConfigurationError) {
    return NextResponse.json(
      { error: "Provenance service is not configured for this operation.", code: "SERVICE_CONFIGURATION" },
      { status: 503 },
    );
  }
  if (error instanceof UpstreamError) {
    return NextResponse.json(
      { error: "A provenance dependency did not complete the request.", code: "UPSTREAM_FAILURE" },
      { status: 502 },
    );
  }
  return NextResponse.json({ error: "Unexpected provenance service failure.", code: "INTERNAL_ERROR" }, { status: 500 });
}
