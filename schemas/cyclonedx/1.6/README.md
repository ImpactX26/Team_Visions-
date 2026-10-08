# Pinned official CycloneDX 1.6 schemas

Downloaded 8 October 2026 from CycloneDX/specification ref `1.6`, resolved to commit `55343ba19dee1785acf1ce9191540d5fd7b590db`. The upstream BOM schema, SPDX and JSF dependencies, and Apache 2.0 license are unmodified. Exact source URLs and SHA-256 checksums are in `provenance.json`.

`backend/services/cbom_schema.py` checks file hashes and resolves references only through a local registry. Runtime validation requires no network. Replacing schema files requires an explicit provenance/checksum update and new validation results.

`jsonschema==4.26.0` is the pinned validator. Its new transitive dependencies were added to the existing hashed lockfile without upgrading existing packages. Docker includes this directory.

Schema acceptance validates document structure, not completeness, detector accuracy, secret absence, or native cryptographic semantics. Those require separate contracts/tests. ECDAT's current standalone export retains findings as library components with ECDAT properties; it explicitly identifies that mapping limitation in metadata.
