"use client";

import { FormEvent, useState } from "react";
import type { NextPage } from "next";

type AnchorResult = {
  cid: string;
  sha256: string;
  topicId: string;
  transactionId: string;
  status: string;
  sequenceNumber: number;
};

type VerifyResult = {
  verified: boolean;
  cid: string;
  sha256: string;
  topicId: string;
  sequenceNumber: number | null;
  consensusTimestamp: string | null;
};

const Home: NextPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUri, setSourceUri] = useState("");
  const [writeApiKey, setWriteApiKey] = useState("");
  const [result, setResult] = useState<AnchorResult | null>(null);
  const [verification, setVerification] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const anchor = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError("");
    setVerification(null);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", file.name);
      if (sourceUri.trim()) body.set("sourceUri", sourceUri.trim());

      const headers = writeApiKey ? { Authorization: `Bearer ${writeApiKey}` } : undefined;
      const response = await fetch("/api/provenance", { method: "POST", body, headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to anchor evidence");

      setResult(payload as AnchorResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to anchor evidence");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!result?.cid) return;

    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        cid: result.cid,
        sequenceNumber: String(result.sequenceNumber),
      });
      const response = await fetch(`/api/provenance/verify?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok && response.status !== 404) throw new Error(payload.error || "Unable to verify evidence");
      setVerification(payload as VerifyResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify evidence");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grow px-5 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <section className="rounded-2xl border border-base-300 bg-base-100 p-8 shadow-lg">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Scaffold-HBAR template</p>
          <h1 className="text-4xl font-bold">Verifiable RAG provenance</h1>
          <p className="mt-4 max-w-2xl text-base-content/70">
            Pin evidence to IPFS, hash the exact bytes, and timestamp the CID + digest on Hedera Consensus Service.
            Anyone can later retrieve the content and verify that it matches the immutable HCS attestation.
          </p>
        </section>

        <form onSubmit={anchor} className="rounded-2xl border border-base-300 bg-base-100 p-8 shadow-md">
          <div className="space-y-5">
            <label className="form-control w-full">
              <span className="label-text mb-2 font-semibold">Evidence file</span>
              <input
                type="file"
                className="file-input file-input-bordered w-full"
                onChange={event => setFile(event.target.files?.[0] ?? null)}
                required
              />
              <span className="mt-2 text-xs text-base-content/60">Template limit: 5 MiB.</span>
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-2 font-semibold">Original source URI (optional)</span>
              <input
                className="input input-bordered w-full"
                placeholder="https://docs.example.com/page"
                value={sourceUri}
                onChange={event => setSourceUri(event.target.value)}
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-2 font-semibold">Write API key</span>
              <input
                type="password"
                autoComplete="off"
                className="input input-bordered w-full"
                placeholder="Required for production writes"
                value={writeApiKey}
                onChange={event => setWriteApiKey(event.target.value)}
              />
              <span className="mt-2 text-xs text-base-content/60">
                Kept only in current browser-tab memory and sent as a Bearer token. Local development can leave it blank.
              </span>
            </label>

            <button className="btn btn-primary" disabled={!file || busy}>
              {busy ? "Working…" : "Anchor provenance"}
            </button>
          </div>
        </form>

        {error && <div className="alert alert-error">{error}</div>}

        {result && (
          <section className="rounded-2xl border border-base-300 bg-base-100 p-8 shadow-md">
            <h2 className="text-2xl font-bold">Attestation created</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <div>
                <dt className="font-semibold">IPFS CID</dt>
                <dd className="break-all font-mono">{result.cid}</dd>
              </div>
              <div>
                <dt className="font-semibold">SHA-256</dt>
                <dd className="break-all font-mono">{result.sha256}</dd>
              </div>
              <div>
                <dt className="font-semibold">HCS topic</dt>
                <dd className="font-mono">{result.topicId}</dd>
              </div>
              <div>
                <dt className="font-semibold">Transaction</dt>
                <dd className="break-all font-mono">{result.transactionId}</dd>
              </div>
              <div>
                <dt className="font-semibold">HCS sequence</dt>
                <dd className="font-mono">#{result.sequenceNumber}</dd>
              </div>
            </dl>

            <button className="btn btn-secondary mt-6" onClick={verify} disabled={busy}>
              Verify from IPFS + Mirror Node
            </button>
          </section>
        )}

        {verification && (
          <div className={`alert ${verification.verified ? "alert-success" : "alert-warning"}`}>
            <div>
              <div className="font-bold">{verification.verified ? "Verified" : "Not verified"}</div>
              <div className="text-sm">
                {verification.verified
                  ? `HCS sequence #${verification.sequenceNumber} at ${verification.consensusTimestamp}`
                  : "No matching HCS message was found for the bytes returned by the configured IPFS gateway."}
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1 · Store", "The evidence bytes are content-addressed and pinned through IPFS."],
            ["2 · Attest", "CID, SHA-256 and source metadata are submitted to an HCS topic."],
            ["3 · Verify", "Fetch by CID, re-hash locally, then match the attestation through Mirror Node."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-base-300 bg-base-100 p-6">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-sm text-base-content/70">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
};

export default Home;
