# Demo video script — simple recording version (target 3:15–3:45)

The submission form requires a public video under five minutes. This version is intentionally high-level: explain the idea, show the working flow, and prove the Hedera transaction without diving into implementation internals.

## Recording format

Screen recording + voice-over is enough for this script. Keep the relevant tabs open before recording so the video is mostly narration and simple tab changes.

Recommended tabs:

1. GitHub README / architecture diagram
2. Local app
3. `proofs/testnet-proof.json`
4. HashScan transaction
5. Mirror Node message
6. GitHub Actions (optional closing proof)

Do not show `.env.local`, private keys, wallet seeds, shell history with secrets, or environment-variable values.

---

## 0:00–0:35 — The problem

**Screen:** repository README and the main flow diagram.

**Narration:**

“AI and RAG systems usually keep a link to a source, but that does not prove which exact version of the source was actually used. A webpage or document can change later, so simply storing the URL is not enough.

This template solves that by creating a verifiable record of the exact source data used by the AI system.”

---

## 0:35–1:15 — The idea and design

**Screen:** README flow diagram.

**Narration:**

“The design is simple.

First, the original source is stored using IPFS, so it gets a content-based identifier. We also calculate a SHA-256 hash of the exact bytes.

Then we write a small attestation to Hedera Consensus Service containing the IPFS identifier, the hash, and basic source information.

Hedera gives that record an immutable consensus timestamp and sequence number.

Later, anyone can retrieve the source again, calculate its hash, and compare it with the Hedera record. If everything matches, we know we are looking at exactly the same evidence that was originally anchored.”

**Simple mental model to show on screen:**

```
Source
  ↓
IPFS + SHA-256
  ↓
Hedera HCS attestation
  ↓
Public verification
```

---

## 1:15–2:10 — Live demo: anchor evidence

**Screen:** local app.

Upload a small public/non-sensitive text or PDF file and press **Anchor provenance**.

**Narration:**

“Here is the template running locally.

I select a source file and anchor its provenance. The application stores the evidence in IPFS, hashes the exact file, and records the provenance attestation on Hedera Testnet.

The result gives us the IPFS CID, the SHA-256 hash, the Hedera topic, the sequence number, and the transaction ID.

The important point is that the document itself does not need to be placed on-chain. Hedera stores the small verification record, while IPFS stores the content.”

Pause briefly so the result is readable.

---

## 2:10–2:45 — Verify it

**Screen:** press **Verify from IPFS + Mirror Node**.

**Narration:**

“Now I can verify the evidence independently.

The application retrieves the content from IPFS, calculates the hash again, and reads the matching Hedera Consensus Service message through Mirror Node.

If the source bytes, hash, and Hedera attestation all match, the result is verified.

This means a later user or AI system does not need to trust the application database to know which evidence was originally used.”

Show the successful **Verified** state.

---

## 2:45–3:15 — Public proof

**Screen:** switch to `proofs/testnet-proof.json`, then HashScan, then Mirror Node.

**Narration:**

“The repository also includes a real public Hedera Testnet proof.

This is the committed proof file, and here is the same transaction visible independently in HashScan and the corresponding HCS message in Mirror Node.

So the Hedera integration shown in the template is real and publicly verifiable, not mocked.”

Use the URLs from the current `proofs/testnet-proof.json`.

---

## 3:15–3:40 — Why this is useful as a template

**Screen:** return to README. Optionally show green GitHub Actions.

**Narration:**

“The goal is not just this demo. This is a reusable Scaffold-HBAR template.

A developer can scaffold it as a starting point for RAG systems, AI agents, document pipelines, audits, or any workflow where they need to prove which exact source data was used at a particular point in time.

IPFS provides content addressing, and Hedera provides the public consensus record and timestamp. Together they give the application a simple provenance layer that developers can reuse.”

Close on the repository title.

---

## Optional final sentence

“Thanks for reviewing RAG Provenance.”

## Recording checklist

- Stay below 5:00; target about 3:30.
- Screen recording + voice-over.
- Prepare tabs before starting.
- Keep explanations high-level.
- Show one real anchor and one successful verification.
- Make the CID, SHA-256, HCS topic/sequence and transaction visible long enough to read.
- Show the public HashScan and Mirror Node evidence.
- Never show secrets, `.env.local`, wallet seed, private keys or environment-variable values.
- Upload the final video somewhere reviewers can open without authentication.
