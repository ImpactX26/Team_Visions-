"""Semantic assertions independent of schema validation."""
from types import SimpleNamespace

import pytest

from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.services.cbom_mapping import crypto_component
from backend.services.cbom_schema import validate_cbom


def mapped(algorithm, usage="unknown", details=None, source=None, key_size=None):
    return crypto_component(SimpleNamespace(id=1, algorithm=algorithm, usage=usage, key_size=key_size,
        source=source or ["ast"], evidence_kind="observed_operation",
        evidence_json={"evidence_list": [{"evidence": details or {}}]}), [{"name": "evidence", "value": "retained"}])


@pytest.mark.parametrize("algorithm,usage,details,key_size,primitive", [
    ("SHA-256", "hashing", {}, None, "hash"),
    ("HMAC", "unknown", {"digest_algorithm": "SHA-256", "call": "node:crypto.createHmac"}, None, "mac"),
    ("AES", "encryption", {"mode": "GCM"}, 256, "ae"),
    ("AES", "encryption", {"mode": "CBC"}, 128, "block-cipher"),
    ("RSA", "signature", {}, 2048, "signature"),
    ("RSA", "encryption", {}, 2048, "pke"),
    ("RSA", "unknown", {"operation": "key_generation", "call": "node:crypto.generateKeyPairSync"}, 2048, "unknown"),
    ("ECDH", "key_establishment", {"curve": "prime256v1"}, None, "key-agree"),
    ("ChaCha20", "encryption", {"authenticated_encryption": True}, None, "ae"),
])
def test_native_algorithm_semantics(algorithm, usage, details, key_size, primitive):
    component = mapped(algorithm, usage, details, key_size=key_size)
    assert component["type"] == "cryptographic-asset"
    props = component["cryptoProperties"]["algorithmProperties"]
    assert props["primitive"] == primitive
    assert "classicalSecurityLevel" not in props
    assert "nistQuantumSecurityLevel" not in props
    assert "executionEnvironment" not in props
    if key_size:
        assert props["parameterSetIdentifier"] == str(key_size)
    assert validate_cbom({"bomFormat": "CycloneDX", "specVersion": "1.6", "components": [component]}) == []


def test_hmac_is_not_bare_digest_and_keygen_is_not_signing():
    hmac = mapped("HMAC", details={"digest_algorithm": "SHA-256", "call": "node:crypto.createHmac"})
    assert hmac["name"] == "HMAC-SHA-256"
    assert hmac["cryptoProperties"]["algorithmProperties"]["cryptoFunctions"] == ["tag"]
    rsa = mapped("RSA", details={"operation": "key_generation", "call": "node:crypto.generateKeyPairSync"})
    assert rsa["cryptoProperties"]["algorithmProperties"] == {"primitive": "unknown", "cryptoFunctions": ["keygen"]}


def test_protocol_certificate_and_unmapped_preserve_unknowns():
    assert mapped("TLS")["cryptoProperties"] == {"assetType": "protocol", "protocolProperties": {"type": "tls"}}
    cert = mapped("RSA", details={"serial_number": "1", "subject_dn": "CN=example"}, source=["cert"])
    assert cert["cryptoProperties"] == {"assetType": "certificate", "certificateProperties": {"subjectName": "CN=example"}}
    assert "signatureAlgorithmRef" not in cert["cryptoProperties"]["certificateProperties"]
    unknown = mapped("UNKNOWN")
    assert unknown["type"] == "data" and "cryptoProperties" not in unknown
    assert unknown["properties"][0]["value"] == "retained"


def test_disagreeing_evidence_does_not_invent_mode():
    asset = SimpleNamespace(id=1, algorithm="AES", usage="encryption", key_size=None, source=["ast"],
        evidence_kind="observed_operation", evidence_json={"evidence_list": [{"evidence": {"mode": "GCM"}}, {"evidence": {"mode": "CBC"}}]})
    assert crypto_component(asset, [])["cryptoProperties"]["algorithmProperties"] == {"primitive": "block-cipher"}


def test_crypto_references_are_verified():
    component = mapped("RSA", details={"serial_number": "1"}, source=["cert"])
    component["cryptoProperties"]["certificateProperties"]["subjectPublicKeyRef"] = "missing"
    assert "Dangling cryptographic reference" in validate_cbom({"bomFormat": "CycloneDX", "specVersion": "1.6", "components": [component]})


def test_page_and_complete_export_share_native_mapping(client, session_factory):
    with session_factory() as db:
        scan = ScanJobDB(repo_path="/semantics", status="completed")
        db.add(scan)
        db.flush()
        asset = CryptoAssetDB(scan_job_id=scan.id, algorithm="AES", key_size=256, usage="encryption",
            location="fixture.ts", source=["ast"], evidence_kind="observed_operation",
            evidence_json={"evidence_list": [{"evidence": {"mode": "GCM", "call": "node:crypto.createCipheriv"}}]})
        db.add(asset)
        db.commit()
        scan_id = scan.id
    page = client.get(f"/api/cbom?scan_id={scan_id}").json()["components"][0]
    complete_response = client.get(f"/api/exports/cbom?scan_id={scan_id}")
    assert complete_response.status_code == 200
    complete = complete_response.json()["components"][0]
    assert page["cryptoProperties"] == complete["cryptoProperties"] == {"assetType": "algorithm",
        "algorithmProperties": {"primitive": "ae", "mode": "gcm", "parameterSetIdentifier": "256", "cryptoFunctions": ["encrypt"]}}
    assert page["bom-ref"] == complete["bom-ref"]
