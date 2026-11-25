"""Zero-dependency tools for web auditing, data analysis, code review, and documents."""

from __future__ import annotations

import csv
import difflib
import io
import json
import math
import re
import statistics
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


class _StructuredHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._heading_tag: str | None = None
        self._heading_buf: list[str] = []
        self.headings: dict[str, list[str]] = {"h1": [], "h2": [], "h3": []}
        self.meta: dict[str, str] = {}
        self.canonical = ""
        self.links: list[dict[str, str]] = []
        self.images: list[dict[str, str]] = []
        self.json_ld: list[str] = []
        self._in_json_ld = False
        self._json_ld_buf: list[str] = []
        self.tables: list[list[list[str]]] = []
        self._current_table: list[list[str]] | None = None
        self._current_row: list[str] | None = None
        self._in_cell = False
        self._cell_buf: list[str] = []
        self._text_parts: list[str] = []
        self._skip_text = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if tag in ("script", "style"):
            self._skip_text = True
            if tag == "script" and attr_map.get("type", "").lower() == "application/ld+json":
                self._in_json_ld = True
                self._json_ld_buf = []
        elif tag == "title":
            self._in_title = True
        elif tag in self.headings:
            self._heading_tag = tag
            self._heading_buf = []
        elif tag == "meta":
            key = (attr_map.get("name") or attr_map.get("property") or "").lower()
            if key:
                self.meta[key] = attr_map.get("content", "")
        elif tag == "link" and attr_map.get("rel", "").lower() == "canonical":
            self.canonical = attr_map.get("href", "")
        elif tag == "a" and "href" in attr_map:
            self.links.append({"href": attr_map["href"]})
        elif tag == "img":
            self.images.append({"src": attr_map.get("src", ""), "alt": attr_map.get("alt", "")})
        elif tag == "table":
            self._current_table = []
        elif tag == "tr" and self._current_table is not None:
            self._current_row = []
        elif tag in ("td", "th") and self._current_row is not None:
            self._in_cell = True
            self._cell_buf = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in ("script", "style"):
            self._skip_text = False
            if tag == "script" and self._in_json_ld:
                self.json_ld.append("".join(self._json_ld_buf).strip())
                self._in_json_ld = False
        elif tag == "title":
            self._in_title = False
        elif tag == self._heading_tag:
            text = " ".join("".join(self._heading_buf).split())
            if text:
                self.headings[tag].append(text)
            self._heading_tag = None
        elif tag in ("td", "th") and self._in_cell:
            cell_text = " ".join("".join(self._cell_buf).split())
            if self._current_row is not None:
                self._current_row.append(cell_text)
            self._in_cell = False
        elif tag == "tr" and self._current_table is not None and self._current_row is not None:
            if any(self._current_row):
                self._current_table.append(self._current_row)
            self._current_row = None
        elif tag == "table" and self._current_table is not None:
            if self._current_table:
                self.tables.append(self._current_table)
            self._current_table = None

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._json_ld_buf.append(data)
            return
        if self._in_title:
            self.title += data
        if self._heading_tag:
            self._heading_buf.append(data)
        if self._in_cell:
            self._cell_buf.append(data)
        if not self._skip_text:
            cleaned = data.strip()
            if cleaned:
                self._text_parts.append(cleaned)


def fetch_url(url: str, timeout: int = 12) -> dict[str, Any]:
    """Fetches a public HTTP(S) URL and returns status, headers, and body."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ai-agent-hub/0.1 (+https://github.com/developer-assistants/ai-agent)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(500_000).decode("utf-8", errors="replace")
            return {
                "url": resp.geturl(),
                "status_code": resp.status,
                "content_type": resp.headers.get("Content-Type", ""),
                "body": body,
                "ok": True,
            }
    except urllib.error.HTTPError as exc:
        return {
            "url": url,
            "status_code": exc.code,
            "content_type": "",
            "body": "",
            "ok": False,
            "error": str(exc),
        }
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return {
            "url": url,
            "status_code": 0,
            "content_type": "",
            "body": "",
            "ok": False,
            "error": str(exc),
        }


def parse_html_document(html: str) -> dict[str, Any]:
    """Parses HTML into structured SEO metadata, headings, links, images, tables, and JSON-LD."""
    parser = _StructuredHTMLParser()
    parser.feed(html)
    title = " ".join(parser.title.split())
    text = " ".join(parser._text_parts)
    words = text.split()
    missing_alt = [img for img in parser.images if not img["alt"].strip()]
    valid_json_ld = []
    for block in parser.json_ld:
        try:
            valid_json_ld.append(json.loads(block))
        except json.JSONDecodeError:
            pass
    return {
        "title": title,
        "title_length": len(title),
        "description": parser.meta.get("description", ""),
        "description_length": len(parser.meta.get("description", "")),
        "canonical": parser.canonical,
        "robots": parser.meta.get("robots", ""),
        "og_title": parser.meta.get("og:title", ""),
        "og_description": parser.meta.get("og:description", ""),
        "headings": parser.headings,
        "link_count": len(parser.links),
        "links": parser.links[:50],
        "image_count": len(parser.images),
        "images_missing_alt": len(missing_alt),
        "json_ld_count": len(valid_json_ld),
        "tables": parser.tables,
        "word_count": len(words),
        "text_excerpt": text[:600],
    }


def analyze_csv_text(csv_text: str) -> dict[str, Any]:
    """Profiles a CSV dataset: schema, missing cells, numeric stats, and z-score anomalies."""
    sample = csv_text.strip()
    if not sample:
        return {"rows": 0, "columns": [], "numeric_stats": {}, "anomalies": []}

    reader = csv.DictReader(io.StringIO(sample))
    columns = list(reader.fieldnames or [])
    rows = list(reader)
    missing_counts = {col: 0 for col in columns}
    numeric_values: dict[str, list[tuple[int, float]]] = {col: [] for col in columns}

    for idx, row in enumerate(rows, start=1):
        for col in columns:
            raw = (row.get(col) or "").strip()
            if not raw:
                missing_counts[col] += 1
                continue
            cleaned = raw.replace(",", "").replace("$", "").replace("%", "")
            try:
                val = float(cleaned)
                if math.isfinite(val):
                    numeric_values[col].append((idx, val))
            except ValueError:
                pass

    numeric_stats: dict[str, dict[str, float]] = {}
    anomalies: list[dict[str, Any]] = []
    for col, pairs in numeric_values.items():
        if len(pairs) < max(2, int(len(rows) * 0.5)):
            continue
        vals = [v for _, v in pairs]
        mean_val = statistics.mean(vals)
        stdev_val = statistics.pstdev(vals) if len(vals) > 1 else 0.0
        numeric_stats[col] = {
            "count": float(len(vals)),
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
            "mean": round(mean_val, 4),
            "median": round(statistics.median(vals), 4),
            "sum": round(sum(vals), 4),
            "stdev": round(stdev_val, 4),
        }
        if stdev_val > 0:
            for row_num, val in pairs:
                z_score = (val - mean_val) / stdev_val
                if abs(z_score) >= 2.0:
                    anomalies.append(
                        {
                            "row": row_num,
                            "column": col,
                            "value": val,
                            "z_score": round(z_score, 2),
                        }
                    )

    return {
        "rows": len(rows),
        "columns": columns,
        "missing_counts": missing_counts,
        "numeric_stats": numeric_stats,
        "anomalies": anomalies[:20],
    }


def scan_source_code(source: str, filename: str = "snippet.py") -> dict[str, Any]:
    """Performs static checks on source code for common reliability and security issues."""
    lines = source.splitlines()
    issues: list[dict[str, Any]] = []
    patterns = [
        ("high", "Dynamic code execution", re.compile(r"\b(eval|exec)\s*\(")),
        (
            "high",
            "Potential hardcoded secret",
            re.compile(r"(?i)(api_key|secret|password|token)\s*=\s*['\"][^'\"]{8,}['\"]"),
        ),
        ("medium", "Bare except clause", re.compile(r"^\s*except\s*:\s*$")),
        ("medium", "Shell invocation with shell=True", re.compile(r"shell\s*=\s*True")),
        ("low", "Unresolved TODO/FIXME marker", re.compile(r"\b(TODO|FIXME|HACK)\b")),
        ("low", "Debug print statement", re.compile(r"^\s*(print|console\.log)\s*\(")),
    ]

    for lineno, line in enumerate(lines, start=1):
        for severity, title, regex in patterns:
            if regex.search(line):
                issues.append(
                    {
                        "severity": severity,
                        "title": title,
                        "line": lineno,
                        "detail": f"{filename}:{lineno} -> {line.strip()[:120]}",
                    }
                )
        if len(line) > 120:
            issues.append(
                {
                    "severity": "low",
                    "title": "Long line (>120 chars)",
                    "line": lineno,
                    "detail": f"{filename}:{lineno} has {len(line)} characters.",
                }
            )

    function_defs = sum(
        1 for line in lines if re.match(r"^\s*(def |async def |function |const \w+ = \()", line)
    )
    return {
        "filename": filename,
        "line_count": len(lines),
        "function_count": function_defs,
        "issue_count": len(issues),
        "issues": issues[:30],
    }


def extract_document_fields(text: str) -> dict[str, Any]:
    """Extracts structured invoice/document fields and verifies arithmetic totals."""
    invoice_match = re.search(
        r"(?i)(?:invoice|inv|receipt)\s*(?:#|no\.?|number)?\s*[:#]?\s*([A-Z0-9-]{3,24})", text
    )
    date_matches = re.findall(
        r"\b(?:\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b",
        text,
    )
    email_matches = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)

    def _find_amount(label_pattern: str) -> float | None:
        m = re.search(rf"(?i)\b{label_pattern}\s*[:]?\s*\$?\s*([0-9][0-9,]*(?:\.[0-9]{{1,2}})?)", text)
        if not m:
            return None
        return float(m.group(1).replace(",", ""))

    subtotal = _find_amount(r"(?:sub\s*-?\s*total)")
    tax = _find_amount(r"(?:tax|vat)")
    total = _find_amount(r"(?:total\s+due|grand\s+total|amount\s+due|total)")

    line_items: list[dict[str, Any]] = []
    for line in text.splitlines():
        m = re.match(r"^\s*[-*]?\s*(.+?)\s+\$([0-9][0-9,]*(?:\.[0-9]{2}))\s*$", line)
        if m:
            label = m.group(1).strip()
            if not re.match(r"(?i)^(sub\s*-?\s*total|tax|vat|total|amount due|grand total)", label):
                line_items.append({"description": label, "amount": float(m.group(2).replace(",", ""))})

    math_checks: list[str] = []
    math_ok = True
    if line_items and subtotal is not None:
        computed_sub = round(sum(item["amount"] for item in line_items), 2)
        if abs(computed_sub - subtotal) > 0.02:
            math_ok = False
            math_checks.append(
                f"Line items sum to {computed_sub:.2f}, but subtotal states {subtotal:.2f}."
            )
        else:
            math_checks.append(f"Line items sum matches subtotal ({subtotal:.2f}).")
    if subtotal is not None and total is not None:
        expected_total = round(subtotal + (tax or 0.0), 2)
        if abs(expected_total - total) > 0.02:
            math_ok = False
            math_checks.append(
                f"Subtotal + tax equals {expected_total:.2f}, but total states {total:.2f}."
            )
        else:
            math_checks.append(f"Subtotal + tax matches total ({total:.2f}).")

    return {
        "invoice_number": invoice_match.group(1) if invoice_match else None,
        "dates": date_matches[:5],
        "emails": sorted(set(email_matches)),
        "line_items": line_items,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
        "math_ok": math_ok,
        "math_checks": math_checks,
    }


def diff_texts(before: str, after: str) -> dict[str, Any]:
    """Computes line-level additions, removals, and similarity ratio between two snapshots."""
    before_lines = [line.strip() for line in before.splitlines() if line.strip()]
    after_lines = [line.strip() for line in after.splitlines() if line.strip()]
    diff = list(difflib.unified_diff(before_lines, after_lines, lineterm=""))
    added = [line[1:] for line in diff if line.startswith("+") and not line.startswith("+++")]
    removed = [line[1:] for line in diff if line.startswith("-") and not line.startswith("---")]
    ratio = round(difflib.SequenceMatcher(None, before_lines, after_lines).ratio(), 4)
    return {
        "similarity": ratio,
        "added_count": len(added),
        "removed_count": len(removed),
        "added": added[:25],
        "removed": removed[:25],
    }


def search_knowledge_base(query: str, documents: list[dict[str, str]], top_k: int = 3) -> list[dict[str, Any]]:
    """Ranks local knowledge-base articles by token overlap with the query."""
    tokens = {tok for tok in re.findall(r"[a-z0-9]{2,}", query.lower())}
    scored: list[dict[str, Any]] = []
    for doc in documents:
        content = f"{doc.get('title', '')} {doc.get('body', '')}".lower()
        doc_tokens = set(re.findall(r"[a-z0-9]{2,}", content))
        overlap = sorted(tokens & doc_tokens)
        if not overlap:
            continue
        score = round(len(overlap) / max(1, len(tokens)), 3)
        scored.append(
            {
                "id": doc.get("id", ""),
                "title": doc.get("title", ""),
                "score": score,
                "matched_terms": overlap,
                "excerpt": doc.get("body", "")[:280],
            }
        )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_k]


def inspect_local_repo(path: str | Path) -> dict[str, Any]:
    """Inspects a local repository directory for structure, docs, tests, and CI."""
    root = Path(path)
    if not root.exists():
        return {"exists": False, "path": str(root)}

    files = [p for p in root.rglob("*") if p.is_file() and ".git" not in p.parts and "node_modules" not in p.parts]
    rel_names = [str(p.relative_to(root)) for p in files]
    has_readme = any(name.lower() == "readme.md" for name in rel_names)
    has_license = any(name.lower().startswith("license") for name in rel_names)
    has_ci = any(name.startswith(".github/workflows/") for name in rel_names)
    has_tests = any("test" in name.lower() for name in rel_names)
    has_docker = any(name.lower() in ("dockerfile", "docker-compose.yml") for name in rel_names)

    extensions: dict[str, int] = {}
    for p in files:
        ext = p.suffix.lower() or "(no ext)"
        extensions[ext] = extensions.get(ext, 0) + 1

    top_exts = sorted(extensions.items(), key=lambda pair: pair[1], reverse=True)[:8]
    return {
        "exists": True,
        "path": str(root),
        "file_count": len(files),
        "has_readme": has_readme,
        "has_license": has_license,
        "has_ci": has_ci,
        "has_tests": has_tests,
        "has_docker": has_docker,
        "top_extensions": dict(top_exts),
    }
