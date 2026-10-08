"""Pinned CycloneDX validation with local references and no network retrieval."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker
from referencing import Registry, Resource

SCHEMA_ROOT = Path(__file__).resolve().parents[2] / "schemas" / "cyclonedx" / "1.6"


@lru_cache(maxsize=1)
def validator() -> Draft7Validator:
    manifest = json.loads((SCHEMA_ROOT / "provenance.json").read_text())
    registry = Registry()
    schemas = {}
    for item in manifest["files"]:
        data = (SCHEMA_ROOT / item["name"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError("Pinned CycloneDX schema checksum mismatch")
        if item["name"].endswith(".json"):
            schema = json.loads(data)
            schemas[item["name"]] = schema
            resource = Resource.from_contents(schema)
            for uri in (schema["$id"], f"http://cyclonedx.org/schema/{item['name']}",
                        f"https://cyclonedx.org/schema/{item['name']}"):
                registry = registry.with_resource(uri, resource)
    schema = schemas["bom-1.6.schema.json"]
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema, registry=registry, format_checker=FormatChecker())


def validate_cbom(data: dict) -> list[str]:
    errors = [f"{'/'.join(map(str, error.path)) or '$'}: {error.message}"
              for error in validator().iter_errors(data)]
    if not isinstance(data, dict):
        return errors
    if data.get("specVersion") != "1.6":
        errors.append("specVersion must be 1.6 for the pinned schema")
    refs = []
    def collect(value):
        if isinstance(value, dict):
            if isinstance(value.get("bom-ref"), str):
                refs.append(value["bom-ref"])
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
    collect(data)
    if len(refs) != len(set(refs)):
        errors.append("Duplicate bom-ref identifiers")
    dependencies = data.get("dependencies", [])
    if not isinstance(dependencies, list):
        return errors
    for dependency in dependencies:
        if not isinstance(dependency, dict):
            continue
        if not isinstance(dependency.get("dependsOn", []), list) or not isinstance(dependency.get("provides", []), list):
            continue
        for ref in [dependency.get("ref"), *dependency.get("dependsOn", []),
                    *dependency.get("provides", [])]:
            if ref not in refs:
                errors.append("Dangling dependency reference")
    return errors
