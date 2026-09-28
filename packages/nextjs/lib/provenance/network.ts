import { payloadTooLarge, upstreamError } from "./errors";

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted) throw upstreamError("External request timed out.", cause);
    throw upstreamError("External request failed.", cause);
  } finally {
    clearTimeout(timer);
  }
}

export async function readBytesWithLimit(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw payloadTooLarge("Retrieved evidence exceeds the 5 MiB verification limit.");
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw payloadTooLarge("Retrieved evidence exceeds the 5 MiB verification limit.");
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
