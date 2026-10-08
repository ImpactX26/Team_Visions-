# IMPACTX: three-minute ECDAT judge walkthrough

Use the existing authenticated local application. Sign in before starting the timer. The working copy is `C:\Users\Tishan Kumar B\Desktop\ECDAT-SIH-Working`; preserve the original SIH project. Do not display passwords or session tokens. These fixture files are scanned statically and must not be executed.

## Prepare

Run the verified disposable rehearsal to refresh the offline pack:

```powershell
.venv\Scripts\python.exe scripts/rehearse_local_baseline.py --demo-pack docs/demo-evidence/2026-10-08
.venv\Scripts\python.exe scripts/rehearse_local_baseline.py --browser --screenshots docs/demo-evidence/2026-10-08
```

These separate commands verify the controls and browser path, save outputs, and remove their temporary databases and servers. They do not leave a presentation server running. For the actual presentation, use the team's normal local startup and authenticated account; allowlist `demo-repositories` in `ECDAT_ALLOWED_SCAN_ROOTS`. Use existing configuration and never commit account secrets. Pre-scan all three controls so their completed results are available even if a new scan is slow.

Scan admission allows three submissions per client IP per five minutes. Pack generation scans only the three controls; the separate browser rehearsal uses its own disposable API instance. Against a shared presentation server, pre-scan sufficiently early and do not submit all controls plus a fresh scan immediately before judging. A visible 429 is a rate-limit response, not proof the scanner failed. The control verifier respects `Retry-After` if the window is already in use.

## Timed path

| Time | Action | Say |
| --- | --- | --- |
| 0:00–0:25 | Scan `demo-repositories/mixed-risk`, or open its completed scan. Inspect processing counts and failures. | “ECDAT scans source for cryptographic evidence. These are controlled examples. Processing coverage says which supported files were processed; it does not measure detection accuracy.” |
| 0:25–0:55 | Open inventory, then an observed RSA finding and its source/evidence. | “This finding points to a key-generation operation. A dependency declaration would only show a capability; it would not prove an operation ran. Static discovery does not prove runtime execution.” |
| 0:55–1:30 | Inspect risk context and provenance. Change exposure once, reload and inspect the persisted value. | “Migration priority combines cryptographic evidence with business context. Inputs marked default or unknown are assumptions. Editing exposure preserves the detector evidence and confidence.” |
| 1:30–1:55 | Read the recommendation and reasons. Show MD5/SHA-1 beside RSA/ECDSA and AES. | “Classical weakness and quantum exposure are different reasons to prioritize work. Recommendations guide review; this tool does not automatically prove a replacement is compatible.” |
| 1:55–2:20 | Open CBOM for the same scan and click `Full JSON`. | “This downloads every stored finding for this completed scan, including evidence and risk provenance. It validates against CycloneDX 1.6. The current mapping uses library components and ECDAT properties; native cryptographic-asset mapping is planned.” |
| 2:20–2:45 | Open the prepared negative and positive controls. | “Algorithm words in comments and configuration produce no findings in this negative control. The positive control detects the labelled API calls. These small controls are demonstration checks, not general accuracy benchmarks.” |
| 2:45–3:00 | State limitations and show the export if asked. | “Confidence is an evidence score, not a calibrated probability. Detection metrics apply to their labelled corpus. This local demo scans allowlisted paths on the server; arbitrary uploads and remote cloning are outside today's scope.” |

Use actual scan and asset ids from the current session. Routes: `/scans/<id>`, `/assets?scan_id=<id>`, `/assets/<asset-id>`, `/reports?scan_id=<id>`, `/cbom?scan_id=<id>`. Confirm the CBOM shows the intended scan before downloading. Risk edits change business context; they do not demonstrate source remediation or a before/after finding comparison.

Current UI limitation: the asset form displays `Policy default` for every provenance value other than `user-provided`, including legacy `unknown`. Use fresh controlled scans for the walkthrough. When discussing an older finding, inspect exported `risk_context_provenance` to distinguish unknown from default; do not claim the label makes that distinction. Frontend correction remains with the frontend team.

## Failure and offline fallback

If readiness or login fails, stop the live attempt and open the saved pack. If a scan fails, show its status and reported error; do not call its inventory complete. If export returns an error, show it and use the saved document, explicitly identifying it as pre-generated evidence. Do not silently substitute a different scan.

The pack under `docs/demo-evidence/2026-10-08/` contains labelled control results, three schema-validated complete CBOM files, a desktop evidence/risk screenshot and a 375px CBOM screenshot. Screenshots come from the bundled nine-file integration fixture; the three control exports come from their named repositories. They are separate demonstrations. Machine-specific root paths in control exports are replaced by `<working-copy>` and revalidated; UUIDs and timestamps are generated data.

## Unfamiliar-presenter acceptance check

Ask a teammate who has not followed implementation to use only this page: sign in, find the mixed-risk scan, open RSA evidence, identify one assumed input, edit/reload exposure, read the recommendation, download the same scan's full JSON, and locate both controls. Repeat the critical path at 375px. Record elapsed time and any point needing coaching. Inspect a visible failed scan or download error using existing UI tests or a controlled failed attempt. Completion requires a human result; automated browser checks cannot establish this criterion.

Hosting remains unverified. Use local delivery for this workflow. Two development dependency audit findings remain tracked in the integration report; this walkthrough is not a release certification.
