"""Engineering and research agents: Coding review, GitHub repo audit, and multi-step Research."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ai_agent.engine import BaseAgent
from ai_agent.tools.builtin import fetch_url, inspect_local_repo, parse_html_document, scan_source_code


class CodingAgent(BaseAgent):
    agent_id = "coding"
    name = "Coding & Review Agent"
    category = "Engineering"
    description = "Scans source files for security hazards, bare exceptions, debug artifacts, and maintainability issues."
    tools_used = ["read_source", "scan_source_code"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        filename = str(payload.get("file") or "snippet.py")

        def _load() -> str:
            if payload.get("file"):
                return Path(payload["file"]).read_text(encoding="utf-8")
            return str(payload.get("input", ""))

        source = self.run_step(
            "Load source code",
            "read_source",
            _load,
            lambda s: f"Loaded {len(s.splitlines())} lines from {filename}",
        )
        scan = self.run_step(
            "Run static analysis",
            "scan_source_code",
            lambda: scan_source_code(source, filename=filename),
            lambda r: f"Scanned {r['line_count']} lines, {r['function_count']} functions, {r['issue_count']} issues",
        )
        high = sum(1 for i in scan["issues"] if i["severity"] == "high")
        actions = []
        if high:
            actions.append(f"Fix {high} high-severity issue(s) (secrets or dynamic execution) before merging.")
        if scan["issue_count"] > high:
            actions.append("Clean up bare except blocks, long lines, or debug print statements.")
        if not actions:
            actions.append("Static checks passed with zero issues; run unit test suite next.")

        summary = (
            f"Reviewed {filename} ({scan['line_count']} lines, {scan['function_count']} functions): "
            f"{scan['issue_count']} issue(s) found ({high} high severity)."
        )
        return {"summary": summary, "findings": scan["issues"], "actions": actions, "metadata": scan}


class GitHubAgent(BaseAgent):
    agent_id = "github"
    name = "GitHub Repository Agent"
    category = "Engineering"
    description = "Audits a repository for README coverage, license, tests, Docker config, and CI workflows."
    tools_used = ["inspect_local_repo", "score_repo_readiness"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        target = str(payload.get("path") or payload.get("input") or ".")
        repo = self.run_step(
            "Inspect repository layout",
            "inspect_local_repo",
            lambda: inspect_local_repo(target),
            lambda r: f"Scanned {r.get('file_count', 0)} files in {r['path']}" if r.get("exists") else f"Path not found: {target}",
        )

        def _score() -> dict[str, Any]:
            if not repo.get("exists"):
                return {
                    "score": 0,
                    "findings": [{"severity": "high", "title": "Repository path not found", "detail": f"Could not access {target}."}],
                    "actions": ["Pass a valid local repository directory path."],
                }
            checks = [
                ("has_readme", "README.md present", "Add a README.md with quickstart commands and architecture."),
                ("has_license", "LICENSE file present", "Add an OSI-approved license such as MIT or Apache-2.0."),
                ("has_tests", "Automated tests detected", "Add unit tests covering core modules."),
                ("has_ci", "GitHub Actions CI configured", "Add a .github/workflows/ci.yml workflow."),
                ("has_docker", "Container setup detected", "Add a Dockerfile and docker-compose.yml for 1-command self-hosting."),
            ]
            score = 0
            findings = []
            actions = []
            for key, label, fix in checks:
                if repo.get(key):
                    score += 20
                    findings.append({"severity": "info", "title": label, "detail": "Check passed."})
                else:
                    findings.append({"severity": "medium", "title": f"Missing: {label}", "detail": fix})
                    actions.append(fix)
            if not actions:
                actions.append("Repository meets all open-source readiness checks.")
            return {"score": score, "findings": findings, "actions": actions}

        report = self.run_step(
            "Evaluate open-source readiness",
            "score_repo_readiness",
            _score,
            lambda r: f"Readiness score {r['score']}/100",
        )
        summary = f"Audited repository at {target}: open-source readiness score {report['score']}/100 ({repo.get('file_count', 0)} files)."
        return {"summary": summary, "findings": report["findings"], "actions": report["actions"], "metadata": repo}


class ResearchAgent(BaseAgent):
    agent_id = "research"
    name = "Research Agent"
    category = "Research"
    description = "Breaks a topic into sub-questions, inspects supplied URLs or notes, and synthesizes a cited brief."
    tools_used = ["decompose_topic", "collect_sources", "synthesize_brief"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        topic = str(payload.get("input", "")).strip() or "Open-source AI agents"
        urls: list[str] = list(payload.get("urls") or [])

        subquestions = self.run_step(
            "Decompose research topic",
            "decompose_topic",
            lambda: [
                f"What core problem does {topic} solve in production workflows?",
                f"What architecture, tools, and memory patterns work best for {topic}?",
                f"What are the main risks, costs, and verification checks for {topic}?",
            ],
            lambda qs: f"Planned {len(qs)} research sub-questions",
        )

        def _collect() -> list[dict[str, Any]]:
            sources = []
            for url in urls[:5]:
                fetched = fetch_url(url)
                if fetched["ok"]:
                    doc = parse_html_document(fetched["body"])
                    sources.append({"url": url, "title": doc["title"] or url, "excerpt": doc["text_excerpt"][:240]})
                else:
                    sources.append({"url": url, "title": url, "excerpt": f"Fetch failed: {fetched.get('error', 'unknown')}"})
            return sources

        sources = self.run_step(
            "Collect source evidence",
            "collect_sources",
            _collect,
            lambda s: f"Collected {len(s)} external source(s)" if s else "Running offline synthesis from prompt context",
        )

        llm_brief = self.run_step(
            "Synthesize structured brief",
            "synthesize_brief",
            lambda: self.llm.complete(
                "You are a factual technical researcher. Summarize findings concisely with bullet points.",
                f"Topic: {topic}\nSub-questions: {subquestions}\nSources: {sources}",
            ),
            lambda out: "Synthesized with configured LLM" if out else "Generated deterministic structured brief",
        )

        findings = [
            {"severity": "info", "title": f"Sub-question {idx}", "detail": q}
            for idx, q in enumerate(subquestions, start=1)
        ]
        for src in sources:
            findings.append({"severity": "info", "title": f"Source: {src['title']}", "detail": f"{src['url']} -> {src['excerpt']}"})

        actions = [
            "Validate key quantitative claims against primary documentation before publishing.",
            "Pass specific source URLs with --url to ground the synthesis in live pages." if not sources else "Archive cited URLs and timestamps with the final report.",
        ]
        summary = llm_brief or f"Structured research plan for '{topic}' across {len(subquestions)} core questions and {len(sources)} cited source(s)."
        return {
            "summary": summary,
            "findings": findings,
            "actions": actions,
            "mode": "llm-assisted" if llm_brief else "local-deterministic",
            "metadata": {"topic": topic, "subquestions": subquestions, "sources": sources},
        }
