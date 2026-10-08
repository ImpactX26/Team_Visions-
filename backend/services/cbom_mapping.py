"""Evidence-backed CycloneDX 1.6 subset; unknown fields stay absent.

One component represents one finding, not a runtime object or installed library.
No key material, security level, execution environment or relationship is guessed.
"""
from __future__ import annotations

import re
from typing import Any

MAPPING_VERSION = "ecdat-native-crypto-v1"


def _details(asset) -> dict[str, Any]:
    evidence = asset.evidence_json or {}
    records = evidence.get("evidence_list", [])
    candidates = [record.get("evidence", {}) for record in records if isinstance(record, dict)]
    # A field is usable only when its supplying evidence agrees.
    result = {}
    for key in {key for candidate in candidates for key in candidate}:
        values = [candidate[key] for candidate in candidates if key in candidate]
        if values and all(value == values[0] for value in values):
            result[key] = values[0]
    return result


def crypto_component(asset, properties: list[dict[str, str]]) -> dict:
    """Retain all finding properties while mapping a supported native subset."""
    algorithm = str(asset.algorithm)
    details = _details(asset)
    component = {"type": "cryptographic-asset", "bom-ref": f"ecdat:asset:{asset.id}", "name": algorithm, "properties": list(properties)}
    crypto: dict[str, Any]
    primitive = None
    if "cert" in (asset.source or []) and details.get("serial_number"):
        certificate = {target: details[source] for source, target in {
            "subject_dn": "subjectName", "issuer_dn": "issuerName",
            "validity_not_before": "notValidBefore", "not_after": "notValidAfter",
        }.items() if details.get(source)}
        crypto = {"assetType": "certificate", "certificateProperties": certificate}
    elif algorithm in {"TLS", "SSH", "IPsec", "IKE"}:
        crypto = {"assetType": "protocol", "protocolProperties": {"type": algorithm.lower()}}
    else:
        if re.fullmatch(r"(?:MD5|SHA-(?:1|224|256|384|512)|SHA3-(?:256|512)|BLAKE2)", algorithm):
            primitive = "hash"
        elif algorithm == "HMAC":
            primitive = "mac"
            digest = details.get("digest_algorithm")
            if digest in {"MD5", "SHA-1", "SHA-224", "SHA-256", "SHA-384", "SHA-512", "SHA3-256", "SHA3-512"}:
                component["name"] = "HMAC-" + digest
        elif re.fullmatch(r"AES(?:-(?:128|192|256))?", algorithm):
            primitive = "ae" if details.get("mode") in {"GCM", "CCM"} else "block-cipher"
        elif algorithm in {"DES", "3DES"}:
            primitive = "block-cipher"
        elif algorithm == "ChaCha20":
            primitive = "ae" if details.get("authenticated_encryption") is True else "stream-cipher"
        elif algorithm in {"ECDH", "DH", "X25519"} or re.fullmatch(r"DH-\d+", algorithm):
            primitive = "key-agree"
        elif algorithm in {"PBKDF2", "HKDF", "scrypt", "KDF"}:
            primitive = "kdf"
        elif algorithm in {"RSA", "EC", "ECDSA", "Ed25519", "DSA"} or re.fullmatch(r"(?:RSA-\d+|ECDSA-P\d+)", algorithm):
            primitive = "unknown" if details.get("operation") == "key_generation" else (
                "signature" if asset.usage == "signature" else "pke" if algorithm.startswith("RSA") and asset.usage == "encryption" else "unknown")
        if primitive is None:
            # CycloneDX has no unknown crypto assetType. Retain an explicit data
            # record instead of inventing a library or algorithm primitive.
            component["type"] = "data"
            component["properties"].append({"name": "ecdat:crypto:mapping", "value": "unmapped finding; native asset type unresolved"})
            return component
        props: dict[str, Any] = {"primitive": primitive}
        mode = str(details.get("mode", "")).lower()
        if algorithm.startswith("AES") and mode in {"cbc", "ecb", "ccm", "gcm", "cfb", "ofb", "ctr"}:
            props["mode"] = mode
        if asset.key_size and primitive in {"block-cipher", "ae", "pke", "signature", "key-agree", "unknown"}:
            props["parameterSetIdentifier"] = str(asset.key_size)
        elif primitive == "hash" and re.fullmatch(r"SHA(?:3)?-\d+", algorithm):
            props["parameterSetIdentifier"] = algorithm.rsplit("-", 1)[1]
        if details.get("curve") and isinstance(details["curve"], str):
            props["curve"] = details["curve"]
        call = str(details.get("call", ""))
        function = {"createHash": "digest", "createHmac": "tag", "createCipheriv": "encrypt", "createDecipheriv": "decrypt", "generateKeyPair": "keygen", "generateKeyPairSync": "keygen"}.get(call.removeprefix("node:crypto."))
        if function and asset.evidence_kind == "observed_operation":
            props["cryptoFunctions"] = [function]
        crypto = {"assetType": "algorithm", "algorithmProperties": props}
    component["cryptoProperties"] = crypto
    component["properties"].append({"name": "ecdat:crypto:mapping", "value": MAPPING_VERSION + "; partial evidence-backed mapping"})
    return component
