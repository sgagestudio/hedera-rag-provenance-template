# Provenance architecture

The provenance feature uses a small layered architecture so the trust model remains explicit and the network-facing code stays bounded.

## Layers

```text
HTTP route
  -> security / error mapping / backpressure
  -> application service
       -> domain validation + SHA-256
       -> IPFS adapter
       -> Hedera HCS adapter
       -> Mirror Node adapter
```

- `lib/provenance/domain.ts` contains deterministic validation, hashing and the attestation schema.
- `lib/provenance/application.ts` contains the use cases and depends only on injected interfaces.
- `ipfs.ts`, `hedera.ts` and `mirror.ts` are network adapters.
- `network.ts` centralizes timeouts, response-size limits and safe pagination.
- `security.ts` protects writes and provides per-process backpressure.
- API routes translate domain/integration failures into bounded HTTP responses without reflecting internal exception text.

## Persistence and database choice

There is deliberately no application database in the verification trust path.

- IPFS stores content-addressed evidence bytes.
- HCS stores the immutable attestation history.
- Mirror Node is used as the independent read surface.
- `ProvenancePolicy` is the discovery anchor for the canonical topic/schema.

Adding a database as the verification source would create a second mutable source of truth. A production deployment with very high topic volume may add a database/search index as a **cache/index only**, but verification should still re-check IPFS bytes and HCS/Mirror Node evidence.

## External-query bounds

New HCS submissions return their `topicSequenceNumber` in the Hedera receipt. The anchor API returns that sequence and the browser sends it back during verification, allowing the Mirror Node adapter to query the exact `/messages/{sequence}` resource in one request.

For older/bookmarked CIDs where no sequence is available, verification falls back to bounded Mirror Node pagination until it finds the attestation, the topic history ends, or `PROVENANCE_MIRROR_MAX_PAGES` is reached. This keeps backwards compatibility without making the common path scan topic history.

Every external HTTP request has `PROVENANCE_EXTERNAL_TIMEOUT_MS`, and retrieved IPFS evidence is streamed with the same 5 MiB upper bound used for uploads. Mirror pagination is restricted to the configured Mirror Node origin.

Positive verification responses may be cached briefly by HTTP intermediaries. Negative responses are `no-store` so a later attestation is not hidden by a stale negative cache entry.

## Write security

The write endpoint can cause IPFS storage and a Hedera transaction, so it is not left anonymously writable in production.

- In local development, no token is required by default.
- In `NODE_ENV=production`, writes are disabled unless `PROVENANCE_WRITE_TOKEN` is set.
- Authenticated callers send `Authorization: Bearer <token>`.
- Token comparison uses SHA-256 digests plus constant-time comparison.
- A small per-process in-flight limit prevents accidental local fan-out.

For a horizontally scaled public deployment, put authentication and a distributed rate limiter/API gateway in front of the route as well.

## Input and metadata bounds

- evidence: 5 MiB maximum;
- multipart requests with a declared oversized `Content-Length` are rejected before parsing;
- CID syntax/length is bounded;
- source URI accepts only HTTP(S), rejects embedded credentials and has a length cap;
- title/MIME metadata are bounded;
- serialized attestations are capped to one 1 KiB HCS message.

## Error handling

Expected validation/authentication errors return safe client-facing messages. Configuration, Hedera, IPFS and Mirror Node failures do not reflect raw SDK/upstream exception text to HTTP clients, reducing accidental leakage of internal configuration or service details.
