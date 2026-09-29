# RAG Provenance agent guide

This repository is a **Hardhat-only Scaffold-HBAR external template** for verifiable RAG/source provenance on Hedera.

## Core invariant

`evidence bytes -> SHA-256 + IPFS CID -> HCS attestation -> independent verification`

Any change must preserve these properties:

- Evidence bytes stay off-chain; HCS stores only compact public attestation metadata.
- The digest is computed from the exact bytes that are stored/retrieved.
- HCS is real and load-bearing; do not replace it with mocked application state in the runnable template.
- Verification retrieves evidence by CID, recomputes SHA-256, and independently resolves the HCS attestation through Mirror Node.
- Fresh anchors should verify through the exact HCS sequence returned in the transaction receipt. CID-only verification may use only the bounded, same-origin pagination fallback.
- `ProvenancePolicy` is the on-chain discovery/policy anchor for the canonical topic/schema; do not duplicate evidence bodies into contract storage.
- Never expose or commit `HEDERA_OPERATOR_KEY`, wallet seeds, `.env` files, tokens, or other credentials.

## Repository layout

- `packages/nextjs/` — Next.js app, API routes, provenance domain/application code and IPFS/Hedera/Mirror adapters.
- `packages/hardhat/` — Solidity `ProvenancePolicy`, deployment scripts and contract tests.
- `test/provenance/` — provenance-focused unit tests.
- `proofs/testnet-proof.json` — public, non-secret testnet verification evidence.
- `docs/ARCHITECTURE.md` — trust model, bounds and production-safety design.
- `template.json` — external-template manifest consumed by `create-scaffold-hbar`.

This template does **not** include a Foundry package. Do not add or document Foundry commands unless the template is deliberately converted and the manifest/workspaces are updated together.

## Commands

Run from the repository root:

```bash
# install / quality
yarn install --immutable
yarn lint
yarn next:check-types
yarn next:build

# provenance tests
yarn next:test:provenance

# contracts
yarn hardhat:compile
yarn hardhat:test
yarn hardhat:deploy --network hederaTestnet

# local IPFS + app
yarn ipfs:up
yarn next:dev
yarn ipfs:down

# Hedera provenance helpers
yarn next:provenance:create-topic
yarn next:provenance:testnet-proof
```

The public template entry point is:

```bash
npm create scaffold-hbar@latest --template sgagestudio/hedera-rag-provenance-template
```

Keep that path working after every structural change.

## Change rules

### Domain/application code

- Keep deterministic validation/hashing in `packages/nextjs/lib/provenance/domain.ts`.
- Keep orchestration in `application.ts`; inject network-facing dependencies rather than importing them into domain logic.
- Preserve bounded inputs, metadata and serialized HCS message size.

### External adapters

- IPFS, Hedera and Mirror calls need explicit timeouts/bounds.
- Mirror pagination must remain restricted to the configured Mirror Node origin.
- Do not reflect raw provider/configuration exceptions to HTTP clients.

### Write path

- Local development may allow the browser demo without a write token.
- Production must fail closed when `PROVENANCE_WRITE_TOKEN` is absent.
- Preserve same-origin browser-write protection and local concurrency backpressure.
- A public scaled deployment still needs normal user/session auth and distributed rate limiting at ingress.

### Frontend / Scaffold-HBAR

- This uses the Next.js App Router.
- Use the existing Scaffold-HBAR hooks/components and repository conventions rather than introducing parallel abstractions.
- Contract ABIs/deployments flow through the existing Hardhat workspace.

## Before finalizing a change

For ordinary code changes, run the relevant subset and expand to the full gate when structure/integration changes:

```bash
yarn lint
yarn hardhat:compile
yarn hardhat:test
yarn next:test:provenance
yarn next:check-types
yarn next:build
```

For template/manifest/workspace changes, also validate a fresh external scaffold through the same `npm create scaffold-hbar@latest --template owner/repo` path used by CI.

## Bounty-specific acceptance checklist

- Public MIT repository.
- Valid `template.json`, `README.md`, and this `AGENTS.md`.
- Fresh scaffold/install/lint/build succeeds and the app boots.
- Real Hedera service usage remains load-bearing.
- At least one public testnet transaction is independently verifiable through HashScan or Mirror Node.
- No committed secrets or `.env` files.
- Documentation explains prerequisites, environment variables, architecture and verification without requiring maintainer help.
