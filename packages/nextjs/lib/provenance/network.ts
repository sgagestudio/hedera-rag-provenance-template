import { ProvenanceError, payloadTooLarge, upstreamError } from "./errors";

type ResponseConsumer<T> = (response: Response) => Promise<T>;

export async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  consume: ResponseConsumer<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await consume(response);
  } catch (cause) {
    if (cause instanceof ProvenanceError) throw cause;
    if (controller.signal.aborted) throw upstreamError("External request timed out.", cause);
    throw upstreamError("External request failed.", cause);
  } finally {
    clearTimeout(timer);
  }
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  message: string,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge(message);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function readBytesWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw payloadTooLarge("Retrieved evidence exceeds the 5 MiB verification limit.");
  }

  return readStreamWithLimit(
    response.body,
    maxBytes,
    "Retrieved evidence exceeds the 5 MiB verification limit.",
  );
}

export async function readRequestBodyWithLimit(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw payloadTooLarge("Request body exceeds the template limit.");
  }

  return readStreamWithLimit(request.body, maxBytes, "Request body exceeds the template limit.");
}

export async function readJsonWithLimit<T>(response: Response, maxBytes = 2 * 1024 * 1024): Promise<T> {
  const bytes = await readBytesWithLimit(response, maxBytes);
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
  } catch (cause) {
    throw upstreamError("External service returned invalid JSON.", cause);
  }
}

export function trustedNextUrl(baseUrl: string, next: string): string {
  const base = new URL(baseUrl);
  const resolved = new URL(next, base);
  if (resolved.origin !== base.origin) {
    throw upstreamError("Mirror Node pagination crossed an unexpected origin.");
  }
  return resolved.toString();
}
