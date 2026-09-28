# Bounty submission package

## Submission status

Technical implementation is complete and a real Hedera testnet provenance proof is committed. Final organizer submission remains a human step if the form requires identity/contact details, payout account details, or acceptance of terms.

## Project name

RAG Provenance — Scaffold-HBAR Template

## Three-sentence description

RAG Provenance is a reusable Scaffold-HBAR template for proving exactly which source bytes an AI/RAG pipeline ingested. It content-addresses evidence with IPFS, anchors CID + SHA-256 attestations in a permissioned Hedera Consensus Service topic, and verifies them later through IPFS plus Hedera Mirror Node. A small Solidity policy contract provides an on-chain discovery anchor for the canonical HCS topic and schema without putting source documents on-chain.

## Public links

- Repository: https://github.com/sgagestudio/hedera-rag-provenance-template
- HashScan transaction: https://hashscan.io/testnet/transaction/0.0.10737175%401790638704.703142857
- Mirror Node message: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10768245/messages/1
- Public proof JSON: https://github.com/sgagestudio/hedera-rag-provenance-template/blob/main/proofs/testnet-proof.json

## Evidence summary

- Network: Hedera testnet
- HCS topic: `0.0.10768245`
- Transaction status: `SUCCESS`
- HCS sequence: `1`
- CID: `QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS`
- SHA-256: `704d43948304f88adfe78a98f7f4f2b139a72062562aa20352f5588c387e3cc4`

## Security hardening validation

The final code was revalidated after the architecture/security review:

- 16/16 provenance unit tests pass;
- immutable install succeeds;
- Lint, CI and External Template Gate are green;
- recursive dependency audit at moderate severity reports no suggestions;
- a fresh real IPFS + HCS testnet proof returned `SUCCESS` and was confirmed by Mirror Node.

## Why the integrations are load-bearing

IPFS is the content-addressed evidence layer: the CID identifies the exact stored source bytes. HCS is the immutable ordering/timestamp layer: it records the CID, SHA-256 digest and source metadata under a submit-key-restricted topic. Mirror Node is the independent verification surface used to resolve the attestation, while the Solidity `ProvenancePolicy` contract provides a stable on-chain discovery anchor for the trusted topic/schema.

Removing IPFS would remove retrievable content-addressed evidence. Removing HCS would remove the consensus timestamp and immutable public attestation history. The template therefore demonstrates composition rather than an SDK call added only to satisfy a checklist.

## Eligibility checklist

- [x] Public repository
- [x] MIT licence
- [x] `template.json`
- [x] `README.md`
- [x] `AGENTS.md`
- [x] Next.js + Hardhat monorepo
- [x] External `create-scaffold-hbar` path validated
- [x] Install/lint/build/tests validated
- [x] App/core route implementation present
- [x] Real Hedera service usage
- [x] Real testnet transaction
- [x] HashScan/Mirror Node evidence
- [x] No committed operator secrets or runtime `.env`
- [x] Hedera Harness not used, so no harness spec/validators are claimed
- [ ] Public demo video under five minutes
- [ ] Organizer form submitted by entrant
- [ ] Mainnet Hedera Account ID supplied for possible prize payout

## Organizer form

Current form URL identified for the Scaffold HBAR Template track:

https://docs.google.com/forms/d/e/1FAIpQLSfMrExu3tI95KP9WlwtS9JFka5iy3uWOi8vVK4JqpLbd0FTPA/viewform?entry.1760747509=Scaffold+HBAR+Template&usp=pp_url

Before final submission, re-check that the form still identifies the Scaffold HBAR Template track and that the organizer deadline has not changed.

## Developer-experience feedback draft

### What worked well

The external-template `owner/repo` path makes the template genuinely reusable without requiring an upstream merge. The separation between Scaffold-HBAR's standard monorepo and application-specific Hedera primitives made it possible to preserve the normal developer workflow while adding HCS provenance.

### What was confusing or costly

The external-template path should be documented with an exact mechanical self-check command that mirrors the organizer eligibility gate. Hedera-fork-dependent Hardhat tests can also be sensitive to transient Mirror Node/network failures, so official examples would benefit from retry guidance that distinguishes infrastructure failures from project failures.

### Suggested improvement

Publish a small reference CI workflow for external templates that performs scaffold -> immutable install -> lint -> test -> build -> boot checks and explicitly validates the required `template.json`, licence and proof-link fields. That would let entrants know that the same reproducible path used by reviewers is green before submission.
