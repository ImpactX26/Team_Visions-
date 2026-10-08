"""Manually labelled Node crypto cases; regression evidence, not field accuracy."""
import pytest

from scanner.collectors.js_collector import JSCollector
from scanner.collectors.registry import CollectorRegistry
from scanner.main import scan_with_metrics


@pytest.mark.parametrize("extension", ["js", "ts"])
@pytest.mark.parametrize("code,algorithms", [
    ('import {createHash as hash} from "node:crypto"; hash("sha256");', ["SHA-256"]),
    ('import * as c from "crypto"; c.createHash("md5");', ["MD5"]),
    ('import c from "node:crypto"; const alg="sha512"; c.createHash(alg);', ["SHA-512"]),
    ('const {createHmac: mac}=require("crypto"); mac("sha256", secret);', ["HMAC"]),
    ('const c=require("node:crypto"); c.createCipheriv("aes-256-gcm",key,iv); c.createDecipheriv("aes-128-cbc",key,iv);', ["AES", "AES"]),
    ('import {generateKeyPairSync as gen} from "crypto"; gen("rsa", {modulusLength:2048});', ["RSA"]),
    ('import c from "crypto"; c.generateKeyPairSync("ec", {namedCurve:"prime256v1"});', ["EC"]),
    ('import c from "crypto"; c.createECDH("prime256v1"); c.createDiffieHellman(2048);', ["ECDH", "DH"]),
    ('import c from "crypto"; c.createHash(userInput);', ["UNKNOWN"]),
    ('import c from "crypto"; const a="sha256"; const b=a; c.createHash(b);', ["SHA-256"]),
    ('import c from "crypto"; function f(){return c.createHash("sha384");}', ["SHA-384"]),
    ('// createHash("md5")\nconst description="AES SHA256 crypto.createHash";', []),
    ('const c={createHash(x){return x;}}; c.createHash("md5");', []),
    ('import c from "other"; c.createHash("md5");', []),
    ('import {createHash as h} from "crypto"; function f(h){h("md5");}', []),
    ('import c from "crypto"; function f(c){c.createHash("md5");}', []),
    ('import c from "crypto"; { c.createHash("md5"); const c=other; }', []),
    ('const require=custom; const c=require("crypto"); c.createHash("md5");', []),
    ('import c from "crypto"; c.createHash=custom; c.createHash("md5");', []),
    ('const c=require("crypto"); c=other; c.createHash("md5");', []),
    ('createHash("md5");', []),
    ('import c from "crypto"; for (const c of list){c.createHash("md5");}', []),
    ('import c from "crypto"; for (c of list){c.createHash("md5");}', []),
    ('import {createHash} from "crypto"; const h=createHash; h("sha256");', ["SHA-256"]),
    ('import c from "crypto"; const d=c; d.createHash("sha256");', ["SHA-256"]),
    ('import c from "crypto"; function f(c=other){c.createHash("md5");}', []),
    ('import c from "crypto"; function f(){ c.createHash("md5"); {var c=other;} }', []),
    ('import c from "crypto"; try {} catch(c){c.createHash("md5");}', []),
    ('import c from "crypto"; const a="sha256"; c.createHash(a); a++;', ["UNKNOWN"]),
    ('import c from "crypto"; const a="sha256"; c.createHash(`${a}`);', ["UNKNOWN"]),
    ('import c from "crypto"; let a="sha256"; a="md5"; c.createHash(a);', ["UNKNOWN"]),
])
def test_labelled_operations(tmp_path, extension, code, algorithms):
    path = tmp_path / f"fixture.{extension}"
    path.write_text(code)
    findings = JSCollector().scan_file(str(path))
    assert [finding.algorithm for finding in findings] == algorithms
    assert all(f.source == "ast" and f.span["line_start"] >= 1 for f in findings)
    assert all("secret" not in str(f.evidence) for f in findings)


def test_typescript_annotations_and_key_generation_purpose(tmp_path):
    path = tmp_path / "fixture.ts"
    path.write_text('import c from "crypto"; const alg: string="sha256"; c.createHash(alg); c.generateKeyPairSync("rsa",{modulusLength:2048});')
    findings = JSCollector().scan_file(str(path))
    assert [f.algorithm for f in findings] == ["SHA-256", "RSA"]
    assert findings[1].evidence["usage"] == "unknown"
    assert findings[1].evidence["key_size"] == 2048


@pytest.mark.parametrize("code", ['import type c from "crypto"; c.createHash("md5");', 'import {type createHash as h} from "crypto"; h("md5");'])
def test_type_only_imports_are_not_runtime_bindings(tmp_path, code):
    path = tmp_path / "fixture.ts"
    path.write_text(code)
    assert JSCollector().scan_file(str(path)) == []


@pytest.mark.parametrize("code", ['import c from "crypto"; c.createHash(', 'eval("anything");', 'with (obj) { createHash("md5"); }'])
def test_unsafe_or_invalid_scope_is_failed_file(tmp_path, code):
    path = tmp_path / "fixture.js"
    path.write_text(code)
    with pytest.raises(ValueError):
        JSCollector().scan_file(str(path))


def test_registry_replaces_text_rules(tmp_path):
    registry = CollectorRegistry()
    assert [name for name, _ in registry.handlers_for("file.js")] == ["ast"]
    assert [name for name, _ in registry.handlers_for("file.ts")] == ["ast"]
    (tmp_path / "fixture.js").write_text('import c from "crypto"; c.createHash("sha256");')
    evidence, metrics = scan_with_metrics(str(tmp_path))
    assert sum(len(records) for records in evidence.values()) == 1
    assert metrics["collector_stats"]["ast"] == 1
    assert metrics["failed_files"] == 0
