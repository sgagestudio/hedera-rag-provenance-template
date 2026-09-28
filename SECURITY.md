# Security model

RAG Provenance crosses three trust boundaries: browser -> Next.js server, Next.js server -> Kubo/IPFS, and Next.js server -> Hedera/Mirror Node.

## Protected assets

- `HEDERA_OPERATOR_KEY` and any deployer private key are server-only secrets.
- `PROVENANCE_WRITE_API_KEY` protects the endpoint that can pin data and submit HCS transactions.
- Evidence bytes and HCS attestations are public by design unless the application encrypts evidence before upload.

## Controls in this template

- Production write requests require `PROVENANCE_WRITE_API_KEY`; local development may run without it.
- API keys are compared with a timing-safe comparison and are never compiled into `NEXT_PUBLIC_*` variables.
- Upload size is checked both from HTTP `Content-Length` when present and from the parsed file.
- Evidence verification streams IPFS responses with a hard byte cap instead of buffering an unbounded response.
- IPFS and Mirror Node calls have explicit timeouts.
- Mirror Node pagination is bounded and rejects cross-origin `links.next` URLs.
- New attestations return their HCS sequence number so verification can query the exact Mirror Node message in one request.
- Legacy verification without a sequence number uses a bounded paginated fallback.
- HCS metadata is validated and constrained to one 1024-byte message.
- Concurrent writes are bounded per application instance.
- Internal configuration/upstream errors are logged server-side but not reflected verbatim to clients.
- Public Hedera deployments never fall back to a known Anvil development private key.
- Dependency audit runs in CI at moderate severity or higher.

## Deployment checklist

1. Set a strong random `PROVENANCE_WRITE_API_KEY`.
2. Keep `HEDERA_OPERATOR_KEY` and deployer keys in a secret manager; never in Git or `.env` committed files.
3. Put the Next.js service behind an edge/proxy body-size limit and distributed rate limiter. The in-process concurrency gate is a backpressure control, not a distributed rate limiter.
4. Keep Kubo RPC private. Expose only the gateway if public retrieval is required.
5. Use HTTPS for remote Kubo gateways and Mirror Node endpoints.
6. Encrypt evidence before IPFS if its contents are not intended to be public.
7. Monitor HCS spend and Kubo disk growth.
8. Rotate the write API key if it appears in logs, screenshots, or browser recordings.

## Storage / database note

This template intentionally has no SQL/NoSQL database. Durable evidence is content-addressed in IPFS and the immutable attestation ledger is HCS. Adding a database would only be justified for product-specific indexing, user accounts, analytics, or faster searches across very large topics; it must not become the source of truth for verification.
