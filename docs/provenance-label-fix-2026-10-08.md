# Risk input provenance labels — 8 October 2026

Asset detail now displays `user-provided` as “User-provided”, `policy-default` as “Policy default”, and every other or missing value as “Unknown provenance”. The explanation states that unknown provenance means the value's source was not recorded or is not recognized. Stored values, edit behavior, backend calculations and exports are unchanged.

Three regression cases first failed against the previous implementation: absent legacy provenance, an empty provenance map, and mixed user/default/unknown/unrecognized/missing fields. They pass after the fix. Full frontend suite: 109 tests across 16 files passed. ESLint, formatting, TypeScript/Vite build, existing bundle budgets and diff whitespace checks passed. The initial full sandboxed Vitest run failed to read temporary worker files; the normal-access rerun passed. No browser or real-API rehearsal was performed for this presentation-only change.

Changed application file: `dashboard/src/pages/AssetDetail.tsx`; regressions: `dashboard/src/pages/AssetDetail.test.tsx`. No dependencies changed in this task. Existing release-gate patches and user work were preserved. No commit, push or deployment performed.
