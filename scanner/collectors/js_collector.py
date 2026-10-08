"""Bounded Node crypto syntax analysis; never executes repository code.

Only direct imports/requires and immutable literal selectors are resolved.
Writes, duplicate bindings, dynamic scopes and malformed syntax abstain.
"""
from __future__ import annotations

import os
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import tree_sitter_javascript as javascript
import tree_sitter_typescript as typescript
from tree_sitter import Language, Node, Parser, Point

from scanner.limits import read_bytes
from scanner.models.asset import CryptoAsset
from scanner.rules.crypto_patterns import get_category

VERSION = "node-crypto-ts-v1:tree-sitter-0.25.2:js-0.25.0:ts-0.23.2"
FUNCTIONS = {"function_declaration", "function_expression", "arrow_function", "method_definition", "generator_function", "generator_function_declaration"}
SCOPES = FUNCTIONS | {"program", "statement_block", "catch_clause", "for_statement", "for_in_statement", "switch_statement", "class_body"}
APIS = {"createHash", "createHmac", "createCipheriv", "createDecipheriv", "generateKeyPair", "generateKeyPairSync", "createECDH", "createDiffieHellman"}
HASHES = {"md5": "MD5", "sha1": "SHA-1", "sha224": "SHA-224", "sha256": "SHA-256", "sha384": "SHA-384", "sha512": "SHA-512", "sha3-256": "SHA3-256", "sha3-512": "SHA3-512"}


@dataclass
class Scope:
    parent: Scope | None
    kind: str
    bindings: dict[str, list[tuple[Node, Any]]] = field(default_factory=dict)
    invalid: set[str] = field(default_factory=set)

    def add(self, name: str, node: Node, value: Any = None) -> None:
        self.bindings.setdefault(name, []).append((node, value))

    def owner(self, name: str) -> Scope | None:
        scope: Scope | None = self
        while scope is not None:
            if name in scope.bindings:
                return scope
            scope = scope.parent
        return None


class JSCollector:
    def scan_file(self, path: str, on_error: Callable[[str], None] | None = None) -> list[CryptoAsset]:
        data = read_bytes(path)
        language = typescript.language_typescript() if path.lower().endswith(".ts") else javascript.language()
        started = time.monotonic()
        def read(offset: int, point: Point) -> bytes:
            return data[offset:offset + 4096]
        tree = Parser(Language(language)).parse(read, progress_callback=lambda offset, error: time.monotonic() - started > 2)
        if tree is None:
            raise ValueError("JavaScript parsing time limit exceeded")
        root = tree.root_node
        if root.has_error:
            raise ValueError("Invalid JavaScript/TypeScript syntax")
        def text(node: Node | None) -> str:
            return data[node.start_byte:node.end_byte].decode("utf-8") if node else ""
        def literal(node: Node | None) -> str | int | None:
            if node is None:
                return None
            value = text(node)
            # Escapes and templates deliberately unresolved, never evaluated.
            if node.type == "string" and len(value) >= 2 and "\\" not in value:
                return value[1:-1]
            if node.type == "number" and value.isdigit():
                return int(value)
            return None

        nodes: list[tuple[Node, Scope]] = []
        top = Scope(None, "program")
        stack = [(root, top)]
        while stack:
            node, scope = stack.pop()
            if len(nodes) >= 200_000 or time.monotonic() - started > 4:
                raise ValueError("JavaScript syntax node limit exceeded")
            if node != root and node.type in SCOPES:
                if node.type in FUNCTIONS:
                    name = node.child_by_field_name("name")
                    if name and node.type.endswith("declaration"):
                        scope.add(text(name), name)
                scope = Scope(scope, node.type)
            nodes.append((node, scope))
            stack.extend((child, scope) for child in reversed(node.named_children))

        def names(pattern: Node) -> list[Node]:
            if pattern.type in {"identifier", "shorthand_property_identifier_pattern"}:
                return [pattern]
            if pattern.type in {"required_parameter", "optional_parameter"}:
                part = pattern.child_by_field_name("pattern")
                return names(part) if part else []
            if pattern.type in {"pair_pattern", "assignment_pattern"}:
                part = pattern.child_by_field_name("value") or pattern.child_by_field_name("left")
                return names(part) if part else []
            return [name for child in pattern.named_children for name in names(child)] if pattern.type in {"object_pattern", "array_pattern", "rest_pattern", "formal_parameters"} else []

        # Collect every binding before resolving any call (including hoisting).
        for node, scope in nodes:
            if node.type == "for_in_statement" and node.child_by_field_name("kind"):
                pattern = node.child_by_field_name("left")
                target = scope
                if text(node.child_by_field_name("kind")) == "var":
                    while target.parent and target.kind not in FUNCTIONS | {"program"}:
                        target = target.parent
                if pattern:
                    for name in names(pattern):
                        target.add(text(name), name)
            if node.type in {"formal_parameters", "catch_clause"}:
                pattern = node if node.type == "formal_parameters" else node.child_by_field_name("parameter")
                if pattern:
                    for name in names(pattern):
                        scope.add(text(name), name)
            if node.type in FUNCTIONS and node.child_by_field_name("parameter"):
                name = node.child_by_field_name("parameter")
                if name:
                    for part in names(name):
                        scope.add(text(part), part)
            if node.type in {"class_declaration", "function_expression"}:
                name = node.child_by_field_name("name")
                if name:
                    scope.add(text(name), name)
            if node.type == "import_statement":
                source = literal(node.child_by_field_name("source"))
                if text(node).startswith("import type "):
                    source = None
                for clause in node.named_children:
                    if clause.type != "import_clause":
                        continue
                    for part in clause.named_children:
                        if part.type == "identifier":
                            scope.add(text(part), part, ("namespace",) if source in {"crypto", "node:crypto"} else None)
                        elif part.type == "namespace_import":
                            name = part.named_children[-1]
                            scope.add(text(name), name, ("namespace",) if source in {"crypto", "node:crypto"} else None)
                        elif part.type == "named_imports":
                            for spec in part.named_children:
                                name = spec.child_by_field_name("alias") or spec.child_by_field_name("name")
                                original = spec.child_by_field_name("name")
                                if name:
                                    scope.add(text(name), name, ("api", text(original)) if source in {"crypto", "node:crypto"} and not text(spec).startswith("type ") else None)
            if node.type == "variable_declarator":
                pattern = node.child_by_field_name("name")
                value = node.child_by_field_name("value")
                target = scope
                if node.parent and node.parent.type == "variable_declaration":
                    while target.parent and target.kind not in FUNCTIONS | {"program"}:
                        target = target.parent
                if pattern:
                    for name in names(pattern):
                        target.add(text(name), node, ("initializer", value, pattern, name, scope))

        for node, scope in nodes:
            if node.type in {"assignment_expression", "augmented_assignment_expression", "update_expression"} or (node.type == "for_in_statement" and not node.child_by_field_name("kind")):
                left = node.child_by_field_name("left") or node.child_by_field_name("argument")
                if left:
                    while left.type in {"member_expression", "subscript_expression"}:
                        left = left.child_by_field_name("object") or left
                        if left.type not in {"member_expression", "subscript_expression"}:
                            break
                    for name in names(left):
                        owner = scope.owner(text(name))
                        if owner:
                            owner.invalid.add(text(name))
            if node.type == "with_statement" or (node.type == "call_expression" and text(node.child_by_field_name("function")) == "eval"):
                raise ValueError("Dynamic JavaScript scope is unsupported")

        def resolve(name: str, scope: Scope, at: Node, depth: int = 0) -> Any:
            owner = scope.owner(name)
            if owner is None or name in owner.invalid or len(owner.bindings[name]) != 1 or depth > 8:
                return None
            binding, value = owner.bindings[name][0]
            if not value or value[0] != "initializer":
                return value
            _, init, pattern, part, declared_scope = value
            if init is None or binding.end_byte > at.start_byte:
                return None
            # require must be the unshadowed CommonJS loader.
            if init.type == "call_expression" and text(init.child_by_field_name("function")) == "require" and declared_scope.owner("require") is None:
                args = init.child_by_field_name("arguments")
                if args and len(args.named_children) == 1 and literal(args.named_children[0]) in {"crypto", "node:crypto"}:
                    if pattern.type == "identifier":
                        return ("namespace",)
                    if pattern.type == "object_pattern":
                        key = part.parent.child_by_field_name("key") if part.parent and part.parent.type == "pair_pattern" else part
                        return ("api", text(key))
            if pattern.type != "identifier" or not binding.parent or not text(binding.parent).startswith("const "):
                return None
            selected = literal(init)
            if selected is not None:
                return ("literal", selected)
            if init.type == "identifier":
                return resolve(text(init), declared_scope, binding, depth + 1)
            return None

        findings = []
        for node, scope in nodes:
            if node.type != "call_expression":
                continue
            function = node.child_by_field_name("function")
            api = None
            if function and function.type == "identifier":
                resolved = resolve(text(function), scope, node)
                if resolved and resolved[0] == "api":
                    api = resolved[1]
            elif function and function.type == "member_expression":
                obj = function.child_by_field_name("object")
                if obj and obj.type == "identifier" and resolve(text(obj), scope, node) == ("namespace",):
                    api = text(function.child_by_field_name("property"))
            if api not in APIS:
                continue
            args = node.child_by_field_name("arguments")
            arguments = args.named_children if args else []
            selector = literal(arguments[0]) if arguments else None
            if arguments and arguments[0].type == "identifier":
                resolved = resolve(text(arguments[0]), scope, node)
                selector = resolved[1] if resolved and resolved[0] == "literal" else None
            evidence: dict[str, Any] = {"call": "node:crypto." + api, "library": "node:crypto", "selector_resolution": "unresolved", "usage": "unknown"}
            algorithm = "UNKNOWN"
            if api in {"createHash", "createHmac"}:
                digest = HASHES.get(str(selector).lower())
                evidence["usage"] = "hashing" if api == "createHash" else "mac"
                if digest:
                    algorithm = digest if api == "createHash" else "HMAC"
                    if api == "createHmac":
                        evidence["digest_algorithm"] = digest
            elif api in {"createCipheriv", "createDecipheriv"}:
                evidence["usage"] = "encryption"
                match = re.fullmatch(r"aes-(128|192|256)-(gcm|ccm|cbc|ctr|ecb|cfb|ofb)", str(selector).lower())
                if match:
                    algorithm = "AES"
                    evidence.update(key_size=int(match[1]), mode=match[2].upper())
                elif selector == "chacha20-poly1305":
                    algorithm = "ChaCha20"
                    evidence["authenticated_encryption"] = True
            elif api in {"generateKeyPair", "generateKeyPairSync"}:
                # Key generation does not prove signing/encryption use.
                algorithm = {"rsa": "RSA", "rsa-pss": "RSA", "ec": "EC", "ed25519": "Ed25519", "x25519": "X25519", "dh": "DH", "dsa": "DSA"}.get(str(selector), "UNKNOWN")
                evidence["operation"] = "key_generation"
                if len(arguments) > 1 and arguments[1].type == "object" and all(pair.type == "pair" for pair in arguments[1].named_children):
                    pairs = arguments[1].named_children
                    keys = [text(pair.child_by_field_name("key")) for pair in pairs]
                    for pair in pairs:
                        key = text(pair.child_by_field_name("key"))
                        if keys.count(key) != 1:
                            continue
                        option = literal(pair.child_by_field_name("value"))
                        if key == "modulusLength" and isinstance(option, int) and 512 <= option <= 65536:
                            evidence["key_size"] = option
                        elif key == "namedCurve" and isinstance(option, str) and re.fullmatch(r"[a-zA-Z0-9-]{1,40}", option):
                            evidence["curve"] = option
            elif api == "createECDH":
                algorithm = "ECDH"
                evidence["usage"] = "key_establishment"
                if isinstance(selector, str) and re.fullmatch(r"[a-zA-Z0-9-]{1,40}", selector):
                    evidence["curve"] = selector
            elif api == "createDiffieHellman":
                algorithm = "DH"
                evidence["usage"] = "key_establishment"
                if isinstance(selector, int) and 512 <= selector <= 65536:
                    evidence["key_size"] = selector
            if algorithm != "UNKNOWN":
                evidence["selector_resolution"] = "resolved" if selector is not None else "unresolved"
            findings.append(CryptoAsset(algorithm=algorithm, category=get_category(algorithm), source="ast", location=os.path.normpath(path), evidence=evidence, confidence=0.9 if algorithm != "UNKNOWN" else 0.7, evidence_kind="observed_operation", parser_version=VERSION, span={"file": os.path.normpath(path), "line_start": node.start_point.row + 1, "line_end": node.end_point.row + 1, "column_start": node.start_point.column, "column_end": node.end_point.column}, confidence_reasons=[{"code": "node_crypto_binding", "detail": "Direct Node crypto binding; bounded syntax analysis, execution not proven"}]))
        return findings
