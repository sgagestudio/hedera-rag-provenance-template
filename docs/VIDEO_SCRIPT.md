# Demo video script — target 3:30–4:00

The organizer requires a public video under five minutes. This script is designed to stay below four minutes without relying on a talking-head segment.

## 0:00–0:25 — Problem and template

**Screen:** repository README title, then the one-command scaffold syntax.

**Narration:**

“RAG systems can cite a URL while losing the exact version of the source they actually ingested. RAG Provenance is a Scaffold-HBAR template that proves the exact source bytes, when they were attested, and whether those bytes still match later.”

Show:

```bash
npm create scaffold-hbar@latest --template sgagestudio/hedera-rag-provenance-template
```

## 0:25–0:55 — Architecture

**Screen:** README flow diagram.

**Narration:**

“The evidence bytes are hashed with SHA-256 and pinned to IPFS. The CID, digest and source metadata are submitted to a restricted Hedera Consensus Service topic. Verification retrieves the content again, re-hashes it, and independently finds the matching HCS message through Mirror Node.”

Briefly point to `ProvenancePolicy` as the on-chain discovery anchor for the trusted topic and schema.

## 0:55–1:20 — Start the reusable stack

**Screen:** terminal.

Show:

```bash
yarn ipfs:up
yarn next:dev
```

**Narration:**

“Kubo is included as a reproducible Docker service, while Hedera credentials remain server-only. No source document is placed directly on-chain.”

## 1:20–2:05 — Anchor evidence

**Screen:** app UI.

Upload a small public text/PDF source and trigger the provenance action.

Call out the returned:

- CID
- SHA-256
- HCS topic
- transaction ID

**Narration:**

“The server computes the digest over the exact bytes, adds them to IPFS, and submits a compact attestation to HCS. The HCS topic uses a submit key, so arbitrary third parties cannot forge records into the trusted provenance stream.”

## 2:05–2:45 — Independent verification

**Screen:** click **Verify from IPFS + Mirror Node**.

Show the successful verification state, then open the committed proof JSON.

**Narration:**

“Verification does not trust application state. It retrieves the bytes from IPFS, recomputes SHA-256, and queries Hedera Mirror Node for the matching CID and digest.”

Show HCS topic `0.0.10768245`, sequence `1`, and `SUCCESS`.

## 2:45–3:15 — Public chain evidence

**Screen:** HashScan transaction and/or Mirror Node URL.

HashScan:

https://hashscan.io/testnet/transaction/0.0.10737175%401790638704.703142857

Mirror Node:

https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10768245/messages/1

**Narration:**

“This is a real Hedera testnet proof, not a mocked transaction. The public evidence is committed in the repository and independently inspectable through HashScan and Mirror Node.”

## 3:15–3:45 — Developer handoff

**Screen:** tests/CI and key project files.

Show:

- `template.json`
- `AGENTS.md`
- HCS provenance library
- `ProvenancePolicy.sol`
- green CI/Lint/External Template Gate

**Narration:**

“The project keeps the normal Scaffold-HBAR developer experience and adds a reusable provenance pattern for document ingestion, policies, datasets and RAG pipelines. It passes the public external-template scaffold path, lint, tests and build, so developers can start from the template rather than reconstruct the pattern.”

## Recording checklist

- Keep total runtime below 5:00.
- Use 1080p if practical.
- Hide all terminal/environment windows that could contain credentials.
- Never show `HEDERA_OPERATOR_KEY`.
- Make the HashScan/Mirror proof readable on screen.
- Use a public video URL accessible without login.
