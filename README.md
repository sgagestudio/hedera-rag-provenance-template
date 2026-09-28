# RAG Provenance — Scaffold-HBAR Template

A production-oriented Scaffold-HBAR template for **verifiable RAG source provenance**.

It combines:

- **IPFS content addressing** for evidence bytes;
- **Hedera Consensus Service (HCS)** for immutable, ordered timestamp attestations;
- a small **ProvenancePolicy** Solidity contract on Hedera for discovery of the canonical HCS topic and message schema;
- a Next.js UI/API that can anchor a file and independently verify it later through an IPFS gateway + Hedera Mirror Node.

The goal is not to put documents on-chain. The bytes stay in decentralized storage. Hedera records a compact attestation proving which content hash/CID was observed and when.

## Why this template exists

RAG pipelines routinely ingest changing web pages, PDFs, policies and datasets. Downstream answers may cite a source, but the source itself can change after ingestion. This template gives developers a reusable pattern to answer:

- Which exact bytes were ingested?
- When was that version attested?
- Has the stored content changed?
- Which HCS topic/schema should verifiers trust?

Flow:

```text
evidence bytes
    |
    +--> SHA-256
    |
    +--> IPFS add/pin --------------------> CID
                                               |
                                               v
                     HCS message { CID, SHA-256, source, timestamp }
                                               |
                                               v
                                      Hedera Mirror Node
                                               |
                                               v
IPFS gateway --> re-hash bytes --> match HCS attestation --> VERIFIED
```

## Bounty gate

This repository is intended to satisfy the Scaffold-HBAR external-template gate:

- public MIT-licensed repository;
- `template.json` present;
- `README.md` and `AGENTS.md` present;
- Next.js frontend + Hardhat contracts package;
- clean install/lint/build/test target;
- real HCS usage;
- verifiable Hedera testnet transaction before submission;
- no committed secrets or `.env`.

## Live testnet proof

A real bounty proof has been produced and committed at `proofs/testnet-proof.json`.

- HCS topic: `0.0.10750034`
- transaction status: `SUCCESS`
- HCS sequence: `1`
- CID: `QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS`
- SHA-256: `704d43948304f88adfe78a98f7f4f2b139a72062562aa20352f5588c387e3cc4`
- HashScan: https://hashscan.io/testnet/transaction/0.0.10737175%401790547963.114160473
- Mirror Node: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10750034/messages/1

The committed proof contains only public verification data. Operator credentials remain outside the repository.

## Prerequisites

- Node.js >= 20.18.3
- Corepack/Yarn or npm
- a local Kubo/IPFS node, or another compatible Kubo RPC endpoint
- a Hedera testnet account funded from the faucet

## Quick start

### 1. Install

```bash
corepack enable
yarn install
```

### 2. Start IPFS

The template includes a pinned Kubo Docker service with its RPC API and gateway bound to localhost:

```bash
yarn ipfs:up
```

This uses the official `ipfs/kubo:v0.43.1` image and persists repository data in a Docker volume. Stop it with `yarn ipfs:down`.

### 3. Configure server-only credentials

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

Set:

```text
HEDERA_OPERATOR_ID=0.0.x
HEDERA_OPERATOR_KEY=...
HEDERA_TOPIC_ID=0.0.x
HEDERA_MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com
IPFS_API_URL=http://127.0.0.1:5001/api/v0
IPFS_GATEWAY_URL=http://127.0.0.1:8080
PROVENANCE_WRITE_TOKEN=choose-a-long-random-server-secret
```

Never expose the operator key or write token via a `NEXT_PUBLIC_*` variable.

### Production write protection

The upload/anchor route can create IPFS pins and Hedera transactions. In local development it is usable without extra authentication, but when `NODE_ENV=production` the route is disabled until `PROVENANCE_WRITE_TOKEN` is configured. API callers then send:

```text
Authorization: Bearer <PROVENANCE_WRITE_TOKEN>
```

The browser demo is intentionally optimized for local development. For a public production UI, put your normal user/session authentication plus distributed rate limiting in front of the write route instead of exposing a server token to browser JavaScript.

External IPFS/Mirror requests have bounded timeouts and response sizes. Mirror verification follows trusted same-origin pagination rather than searching only the latest page. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

### 4. Create the HCS topic

With `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` set in `packages/nextjs/.env.local`:

```bash
yarn next:provenance:create-topic
```

Copy the printed topic ID into `HEDERA_TOPIC_ID`. The setup script assigns the operator public key as both the HCS admin key and submit key, so arbitrary third parties cannot forge provenance messages on the trusted topic.

### 5. Compile/test the policy anchor

```bash
yarn hardhat:compile
yarn hardhat:test
```

Deploy it after the HCS topic exists:

```bash
HEDERA_TOPIC_ID=0.0.x yarn hardhat:deploy --network hederaTestnet
```

### 6. Produce a public testnet proof

After Kubo is running and `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` are present in `packages/nextjs/.env.local`:

```bash
yarn next:provenance:testnet-proof
```

The command creates a restricted HCS topic, pins deterministic public evidence to IPFS, submits its CID + SHA-256 attestation to Hedera testnet, waits for Mirror Node confirmation, and writes only public verification data to `proofs/testnet-proof.json`. It never writes or prints the operator private key.

### 7. Run the app

With Kubo running, execute:

```bash
yarn next:dev
```

Open `http://localhost:3000`.

Upload an evidence file. The server:

1. computes SHA-256 over the exact bytes;
2. adds/pins the bytes to IPFS;
3. submits a `rag-provenance-v1` JSON attestation to HCS;
4. returns the CID, digest, HCS topic and transaction ID.

Press **Verify from IPFS + Mirror Node** to retrieve the bytes, re-hash them and locate the matching HCS message.

## Attestation schema

```json
{
  "schema": "rag-provenance-v1",
  "cid": "bafy...",
  "sha256": "<64 hex chars>",
  "sourceUri": "https://docs.example.com/page",
  "title": "source.pdf",
  "mimeType": "application/pdf",
  "size": 12345,
  "capturedAt": "2026-09-27T00:00:00.000Z"
}
```

HCS stores the attestation, not the document body.

## ProvenancePolicy

`packages/hardhat/contracts/ProvenancePolicy.sol` exposes:

- `topicId()` — canonical HCS topic for the deployment;
- `schemaHash()` — hash of the expected schema identifier;
- `setPolicy(...)` — owner-only rotation when a topic/schema changes.

This gives EVM integrations a stable discovery anchor without duplicating every provenance record in contract storage.

## Security notes

- Treat HCS messages as public.
- Treat public IPFS content as public. Encrypt sensitive content before storing it.
- Do not commit Hedera private keys, wallet seeds, `.env` files or storage credentials.
- The upload endpoint enforces a 5 MiB evidence limit, metadata bounds, local backpressure, and production write authentication. Horizontally scaled production deployments should also add distributed rate limiting at the ingress/API gateway.
- Verifiers should trust a topic only after checking the deployed `ProvenancePolicy` or another authenticated configuration source.

## Validation

CI runs:

```bash
yarn install --immutable
yarn hardhat:compile
yarn hardhat:test
yarn next:check-types
yarn next:build
```

The repository also runs an External Template Gate that scaffolds the project through the public `create-scaffold-hbar` custom-template path. Before bounty submission, `proofs/testnet-proof.json` must contain the real HashScan and Mirror Node evidence produced by the command above.

## License

MIT.
