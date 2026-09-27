# Testnet proof

This directory contains public, non-secret evidence for the Scaffold-HBAR bounty submission.

Generate the proof with:

```bash
yarn ipfs:up
yarn next:provenance:testnet-proof
```

The generated `testnet-proof.json` contains only public verification material:

- HCS topic ID;
- IPFS CID and SHA-256 digest;
- Hedera transaction ID and status;
- HCS sequence number and consensus timestamp;
- HashScan transaction URL;
- Mirror Node message URL.

No operator key, wallet seed, account secret, or environment file belongs in this directory.
