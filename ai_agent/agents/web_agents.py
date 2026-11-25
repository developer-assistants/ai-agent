"""Web-focused agents: SEO audit, structured browser extraction, and competitor monitoring."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ai_agent.engine import BaseAgent
from ai_agent.tools.builtin import diff_texts, fetch_url, parse_html_document


def _load_html(payload: dict[str, Any]) -> tuple[str, str]:
    if payload.get("url"):
        fetched = fetch_url(payload["url"])
        return fetched.get("body", ""), payload["url"]
    if payload.get("file"):
        path = Path(payload["file"])
        return path.read_text(encoding="utf-8"), str(path)
    return str(payload.get("input", "")), "inline-html"


class SEOAgent(BaseAgent):
    agent_id = "seo"
    name = "SEO Agent"
    category = "Marketing"
    description = "Audits HTML or live URLs for title, metadata, headings, schema, and accessibility."
    tools_used = ["fetch_url", "parse_html_document", "score_seo_rules"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        html, source = self.run_step(
            "Load target document",
            "fetch_url" if payload.get("url") else "read_input",
            lambda: _load_html(payload),
            lambda res: f"Loaded {len(res[0])} bytes from {res[1]}",
        )
        parsed = self.run_step(
            "Parse HTML structure",
            "parse_html_document",
            lambda: parse_html_document(html),
            lambda doc: f"Parsed {doc['word_count']} words, {len(doc['headings']['h1'])} H1 tags, {doc['link_count']} links",
        )

        def _evaluate() -> dict[str, Any]:
            findings: list[dict[str, Any]] = []
            actions: list[str] = []
            score = 100

            if not parsed["title"]:
                score -= 20
                findings.append({"severity": "high", "title": "Missing title tag", "detail": "No <title> element found."})
                actions.append("Add a unique <title> between 35 and 60 characters.")
            elif not (30 <= parsed["title_length"] <= 65):
                score -= 8
                findings.append(
                    {
                        "severity": "medium",
                        "title": "Title length out of range",
                        "detail": f"Title is {parsed['title_length']} characters (recommended 30 to 65).",
                    }
                )
                actions.append("Adjust title length to stay within 30 to 65 characters.")

            if not parsed["description"]:
                score -= 15
                findings.append({"severity": "high", "title": "Missing meta description", "detail": "No meta description tag found."})
                actions.append("Add a concise meta description between 110 and 160 characters.")
            elif not (100 <= parsed["description_length"] <= 165):
                score -= 6
                findings.append(
                    {
                        "severity": "low",
                        "title": "Meta description length",
                        "detail": f"Meta description is {parsed['description_length']} characters.",
                    }
                )

            h1_count = len(parsed["headings"]["h1"])
            if h1_count != 1:
                score -= 15
                findings.append(
                    {
                        "severity": "high",
                        "title": "H1 count issue",
                        "detail": f"Found {h1_count} H1 elements; pages should have exactly 1.",
                    }
                )
                actions.append("Ensure the page contains a single descriptive H1 heading.")

            if not parsed["canonical"]:
                score -= 10
                findings.append({"severity": "medium", "title": "Missing canonical link", "detail": "No rel=canonical tag detected."})
                actions.append("Add a self-referencing canonical URL.")

            if parsed["images_missing_alt"] > 0:
                score -= 10
                findings.append(
                    {
                        "severity": "medium",
                        "title": "Images missing alt text",
                        "detail": f"{parsed['images_missing_alt']} of {parsed['image_count']} images lack alt attributes.",
                    }
                )
                actions.append("Add descriptive alt attributes to all content images.")

            if parsed["json_ld_count"] == 0:
                score -= 8
                findings.append({"severity": "low", "title": "No JSON-LD structured data", "detail": "No valid application/ld+json blocks found."})
                actions.append("Add Schema.org JSON-LD markup matching the page type.")

            if not actions:
                actions.append("Monitor Search Console impressions and Core Web Vitals after deployment.")
            return {"score": max(0, score), "findings": findings, "actions": actions}

        evaluation = self.run_step(
            "Evaluate technical SEO rules",
            "score_seo_rules",
            _evaluate,
            lambda ev: f"Computed SEO score {ev['score']}/100 with {len(ev['findings'])} findings",
        )
        summary = (
            f"Audited {source}: score {evaluation['score']}/100 across "
            f"{parsed['word_count']} words, {len(evaluation['findings'])} issues found."
        )
        return {
            "summary": summary,
            "findings": evaluation["findings"],
            "actions": evaluation["actions"],
            "metadata": {"source": source, "score": evaluation["score"], "parsed": parsed},
        }


class BrowserAgent(BaseAgent):
    agent_id = "browser"
    name = "Browser & Web Scraping Agent"
    category = "Automation"
    description = "Extracts structured tables, links, headings, and JSON-LD entities from public web pages."
    tools_used = ["fetch_url", "parse_html_document", "extract_structured_records"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        html, source = self.run_step(
            "Fetch target page",
            "fetch_url" if payload.get("url") else "read_input",
            lambda: _load_html(payload),
            lambda res: f"Retrieved {len(res[0])} bytes from {res[1]}",
        )
        parsed = self.run_step(
            "Extract DOM structures",
            "parse_html_document",
            lambda: parse_html_document(html),
            lambda doc: f"Extracted {len(doc['tables'])} tables, {doc['link_count']} links, {doc['json_ld_count']} JSON-LD objects",
        )
        records = self.run_step(
            "Normalize extracted dataset",
            "extract_structured_records",
            lambda: {
                "title": parsed["title"],
                "tables": parsed["tables"],
                "links": [item["href"] for item in parsed["links"]],
                "headings": parsed["headings"],
            },
            lambda rec: f"Normalized {len(rec['tables'])} tables and {len(rec['links'])} links",
        )
        findings = [
            {
                "severity": "info",
                "title": "Page title and text volume",
                "detail": f"Title '{parsed['title'] or 'Untitled'}' with {parsed['word_count']} visible words.",
            },
            {
                "severity": "info",
                "title": "Structured elements extracted",
                "detail": f"{len(parsed['tables'])} HTML tables, {parsed['link_count']} links, {parsed['json_ld_count']} JSON-LD blocks.",
            },
        ]
        actions = [
            "Export extracted tables to CSV or JSON for downstream pipelines.",
            "Schedule periodic snapshots if this page updates prices or listings.",
        ]
        return {
            "summary": f"Extracted structured data from {source}: {len(parsed['tables'])} tables and {parsed['link_count']} links.",
            "findings": findings,
            "actions": actions,
            "metadata": records,
        }


class CompetitorAgent(BaseAgent):
    agent_id = "competitor"
    name = "Competitor Monitoring Agent"
    category = "Research"
    description = "Snapshots competitor pages, stores baselines in memory, and reports copy or pricing changes."
    tools_used = ["memory_lookup", "diff_texts", "memory_save"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        target_key = str(payload.get("target") or payload.get("url") or "default-competitor")
        current_text = str(payload.get("input", "")).strip()
        baseline_text = payload.get("baseline")

        if payload.get("url") and not current_text:
            fetched = self.run_step(
                "Fetch competitor page",
                "fetch_url",
                lambda: fetch_url(payload["url"]),
                lambda res: f"HTTP {res['status_code']} ({len(res['body'])} bytes)",
            )
            current_text = parse_html_document(fetched["body"])["text_excerpt"]

        previous = self.run_step(
            "Load previous snapshot",
            "memory_lookup",
            lambda: baseline_text if baseline_text is not None else self.memory.get_value("competitor", target_key, ""),
            lambda prev: f"Loaded baseline ({len(prev)} chars)" if prev else "No prior baseline; creating initial snapshot",
        )
        diff = self.run_step(
            "Compare snapshots",
            "diff_texts",
            lambda: diff_texts(previous, current_text) if previous else {"similarity": 1.0, "added_count": 0, "removed_count": 0, "added": [], "removed": []},
            lambda d: f"Similarity {d['similarity']:.2%}, +{d['added_count']} / -{d['removed_count']} lines",
        )
        self.run_step(
            "Store latest snapshot in memory",
            "memory_save",
            lambda: self.memory.set_value("competitor", target_key, current_text) or {"saved": True},
            lambda _: f"Saved baseline for {target_key}",
        )

        findings: list[dict[str, Any]] = []
        if not previous:
            findings.append({"severity": "info", "title": "Baseline recorded", "detail": f"Stored initial snapshot for {target_key}."})
            actions = ["Re-run this agent on a schedule to detect pricing, messaging, or feature updates."]
            summary = f"Recorded initial baseline for {target_key} ({len(current_text)} characters)."
        else:
            for line in diff["added"][:5]:
                findings.append({"severity": "medium", "title": "Added copy", "detail": line})
            for line in diff["removed"][:5]:
                findings.append({"severity": "low", "title": "Removed copy", "detail": line})
            if not findings:
                findings.append({"severity": "info", "title": "No changes detected", "detail": "Page text matches stored baseline."})
            actions = [
                "Review added pricing or positioning claims against your own landing page.",
                "Update battlecards if competitor tier limits or pricing changed.",
            ]
            summary = (
                f"Monitored {target_key}: similarity {diff['similarity']:.1%}, "
                f"{diff['added_count']} additions and {diff['removed_count']} removals."
            )
        return {"summary": summary, "findings": findings, "actions": actions, "metadata": {"target": target_key, "diff": diff}}
