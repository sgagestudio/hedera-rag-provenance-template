export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly timedOut = false,
  ) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

export async function fetchWithTimeout(
  service: string,
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ExternalServiceError(service, `${service} request timed out`, true);
    }
    throw new ExternalServiceError(service, `${service} request failed`);
  } finally {
    clearTimeout(timer);
  }
}

export async function readBytesLimited(
  service: string,
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new ExternalServiceError(service, `${service} response exceeded the size limit`);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ExternalServiceError(service, `${service} response exceeded the size limit`);
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

export async function readJsonLimited<T>(
  service: string,
  response: Response,
  maxBytes: number,
): Promise<T> {
  const bytes = await readBytesLimited(service, response, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new ExternalServiceError(service, `${service} returned invalid JSON`);
  }
}
