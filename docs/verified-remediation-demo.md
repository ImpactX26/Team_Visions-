# ImpactX verified remediation rehearsal

Open `/remediation` on the Desktop project's frontend (port 3000), signed in as an administrator or security analyst.

1. Use the interactive collision evidence to compare MD5 and SHA-256. Expand the changed bytes: two different 128-byte payloads have the same MD5 digest.
2. Review the one-line MD5 → SHA-256 diff and compatibility requirements. Acknowledge the review checkbox.
3. Click **Apply to isolated copy & verify**. The server prepares and scans its owned baseline, applies the reviewed patch to a disposable copy, executes eleven checks, and rescans the patched source. The outcome records measured durations for these stages, without simulated live progress.
4. Show that the baseline verifier accepts the substituted collision payload while the patched verifier rejects it. Read both digest pairs.
5. Show the scanner comparison: MD5 removed, SHA-256 introduced, and the unchanged SHA-512 companion. An incomplete scan or failed check produces an inconclusive verdict.
6. Use Outcome, Checks, and Scanner evidence to inspect the result. Download the JSON evidence or Markdown report, and review the forward/reverse patches. The reverse patch reconstructs the original fixture (including MD5); it is only a rollback rehearsal. Evidence includes source hashes, checks, observations, coverage, run ID and UTC timestamp. Its receipt hash is a checksum, not a signature or external attestation.

The endpoint accepts only the preview's source hash. It accepts no arbitrary source code, file paths, repository URL, or shell command. Verification is rate limited and write-role restricted; runs are audited. No user repository is modified, and disposable copies are removed after the run. No schema migration is required.

## Inventory finding workflow

Every inventory finding has a **Review change & verification** action. Its panel shows the algorithm, intended replacement, compatibility checklist, and downloadable migration plan. RSA, signatures, encryption, certificates, and uncertain/capability observations require manual implementation or evidence review; the panel explains why it cannot create a safe code patch.

Direct Python `hashlib.md5` and `hashlib.sha1` hash operations support real source patch previews when one call can be matched, bindings are not shadowed, and the source hash matches the completed scan manifest. The source must be a bounded, unlinked Python file inside the scanned repository. Missing or changed snapshots require a fresh scan. No user-supplied paths, code, or commands are accepted.

Confirm integrity-checksum usage, review the source diff and consumer migration, then apply to disposable file copies and rescan. The source file is never executed. The result reports `scanner_verified` only if both file-scoped scans complete and observe one weak-digest removal and one SHA-256 addition. This does not execute application tests, resolve inventory findings, or establish application compatibility. Download the forward/reverse patch and verification receipt; run project-specific tests and deploy the coordinated migration separately.

SHA-256 changes checksum values and length; existing stored digests and producers/consumers require migration. Unkeyed hashes do not authenticate senders. These recipes do not implement PQC or replace password hashing, signatures, or TLS. Successful fixture or scanner checks do not prove application-wide security.
