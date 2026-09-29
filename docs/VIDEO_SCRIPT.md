# Demo video script — target 3:50–4:20

The organizer requires a public video under five minutes. This version matches the hardened provenance flow and avoids showing any credentials.

## 0:00–0:25 — Problem and reusable template

**Screen:** repository README title, then the scaffold command.

**Narration:**

“RAG systems often preserve a URL but lose the exact source bytes they actually ingested. RAG Provenance is a Scaffold-HBAR template that content-addresses those bytes, timestamps their digest on Hedera, and lets another verifier prove later that the retrieved content is the same version.”

Show:

```bash
npm create scaffold-hbar@latest --template sgagestudio/hedera-rag-provenance-template
```

## 0:25–0:55 — Architecture and trust model

**Screen:** `docs/ARCHITECTURE.md` and the README flow diagram.

**Narration:**

“The implementation is split into a deterministic domain layer, an application service, and network adapters for IPFS, Hedera HCS and Mirror Node. Evidence bytes stay in IPFS; HCS stores only a compact CID, SHA-256 digest and source metadata. The Solidity ProvenancePolicy contract is the discovery anchor for the canonical HCS topic and schema.”

Briefly point to:

- `lib/provenance/domain.ts`
- `lib/provenance/application.ts`
- `lib/provenance/ipfs.ts`
- `lib/provenance/hedera.ts`
- `lib/provenance/mirror.ts`

## 0:55–1:25 — Start the local stack safely

**Screen:** terminal, with no environment file or credential values visible.

Show:

```bash
yarn ipfs:up
yarn next:dev
```

**Narration:**

“Kubo runs locally through Docker, and Hedera credentials remain server-only. The write endpoint is convenient for local development, but in production it is disabled until a server-side write token is configured. Upload size, metadata, concurrency and external network calls are bounded.”

Do **not** open `.env.local` or print any environment variables.

## 1:25–2:10 — Anchor exact evidence bytes

**Screen:** app UI.

Upload a small public text or PDF source and press **Anchor provenance**.

Call out the returned:

- IPFS CID
- SHA-256
- HCS topic
- HCS sequence
- transaction ID

**Narration:**

“The server hashes the exact uploaded bytes, pins them to IPFS, validates and bounds the attestation metadata, and submits the compact attestation to a submit-key-restricted HCS topic. Hedera’s receipt also returns the topic sequence number, which is carried forward as a direct verification pointer.”

## 2:10–2:55 — Independent verification without topic scanning

**Screen:** press **Verify from IPFS + Mirror Node**.

**Narration:**

“Verification does not trust application state. It retrieves the bytes again from IPFS with a strict size limit, recomputes SHA-256, and asks Mirror Node for the exact HCS sequence returned by Hedera. That makes the normal verification path one Mirror request instead of scanning topic history. For older CID-only links, the template keeps a bounded same-origin pagination fallback.”

Show the successful **Verified** state with the HCS sequence and consensus timestamp.

## 2:55–3:25 — Public Hedera proof

**Screen:** open `proofs/testnet-proof.json`.

Then open the **current** `hashscanTransactionUrl` and `mirrorNodeMessageUrl` values from that file.

**Narration:**

“This repository includes a real Hedera Testnet proof, not mocked chain data. The committed proof records a SUCCESS transaction, the HCS topic and sequence, the IPFS CID, SHA-256 digest, consensus timestamp, and independent HashScan and Mirror Node links.”

Do not hard-code an older topic or transaction in the recording; use the values currently committed in `proofs/testnet-proof.json`.

## 3:25–4:10 — Security, performance and developer handoff

**Screen:** `docs/ARCHITECTURE.md`, test files and green GitHub Actions.

Show:

- domain/application/adapters separation
- `test/provenance/`
- Lint — green
- CI — green
- External Template Gate — green

**Narration:**

“The template is hardened around the expensive boundaries. External calls have timeouts, IPFS and Mirror responses are size-bounded, Mirror pagination cannot cross to an unexpected origin, browser writes reject cross-origin requests, production writes require authorization, and local write concurrency is capped. Provider errors are mapped to bounded client responses rather than reflecting internal configuration. The dependency lockfile also pins the patched Picomatch lines, and the provenance unit tests run in CI alongside compile, contract tests, type-check and build.”

Close on the repository README.

## Recording checklist

- Keep total runtime below 5:00; target about 4:00.
- Use the current `main` branch after the final hardening merge.
- Run the demo locally so the browser upload works without exposing a production write token.
- Use a small **public/non-sensitive** evidence file.
- Never show `HEDERA_OPERATOR_KEY`, `PROVENANCE_WRITE_TOKEN`, `.env.local`, shell history containing secrets, or wallet seeds.
- Open chain URLs from the current `proofs/testnet-proof.json`, not from an old script or note.
- Make the successful verification state, HCS sequence, HashScan transaction and Mirror Node message readable on screen.
- Use a public video URL that reviewers can open without authentication.
