export type ProvenanceErrorCode =
  | "INVALID_INPUT"
  | "PAYLOAD_TOO_LARGE"
  | "WRITE_DISABLED"
  | "UNAUTHORIZED"
  | "CROSS_ORIGIN"
  | "BUSY"
  | "CONFIGURATION_ERROR"
  | "UPSTREAM_ERROR"
  | "MIRROR_SCAN_LIMIT";

export class ProvenanceError extends Error {
  readonly code: ProvenanceErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(
    code: ProvenanceErrorCode,
    message: string,
    options: { status?: number; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProvenanceError";
    this.code = code;
    this.status = options.status ?? 500;
    this.expose = options.expose ?? false;
  }
}

export function invalidInput(message: string): ProvenanceError {
  return new ProvenanceError("INVALID_INPUT", message, { status: 400, expose: true });
}

export function payloadTooLarge(message: string): ProvenanceError {
  return new ProvenanceError("PAYLOAD_TOO_LARGE", message, { status: 413, expose: true });
}

export function configurationError(message: string, cause?: unknown): ProvenanceError {
  return new ProvenanceError("CONFIGURATION_ERROR", message, { status: 503, cause });
}

export function upstreamError(message: string, cause?: unknown): ProvenanceError {
  return new ProvenanceError("UPSTREAM_ERROR", message, { status: 502, cause });
}
