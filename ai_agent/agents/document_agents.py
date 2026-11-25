"""Document and data agents: Invoice extraction, Contract risk review, and CSV/Excel analysis."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from ai_agent.engine import BaseAgent
from ai_agent.tools.builtin import analyze_csv_text, extract_document_fields


def _read_text_payload(payload: dict[str, Any]) -> str:
    if payload.get("file"):
        return Path(payload["file"]).read_text(encoding="utf-8")
    return str(payload.get("input", ""))


class DocumentAgent(BaseAgent):
    agent_id = "document"
    name = "Invoice & Document Agent"
    category = "Finance"
    description = "Extracts invoice IDs, dates, line items, and totals, then verifies arithmetic accuracy."
    tools_used = ["read_document", "extract_document_fields", "verify_arithmetic"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = self.run_step(
            "Load document text",
            "read_document",
            lambda: _read_text_payload(payload),
            lambda t: f"Loaded {len(t)} characters",
        )
        extracted = self.run_step(
            "Extract structured fields",
            "extract_document_fields",
            lambda: extract_document_fields(text),
            lambda d: f"Found invoice {d['invoice_number'] or 'N/A'}, {len(d['line_items'])} line items, total {d['total']}",
        )
        findings: list[dict[str, Any]] = []
        if not extracted["invoice_number"]:
            findings.append({"severity": "medium", "title": "Missing invoice number", "detail": "Could not detect an invoice reference number."})
        for check in extracted["math_checks"]:
            findings.append(
                {
                    "severity": "info" if extracted["math_ok"] else "high",
                    "title": "Arithmetic check",
                    "detail": check,
                }
            )
        if not findings:
            findings.append({"severity": "info", "title": "Document parsed", "detail": f"Extracted total={extracted['total']} with {len(extracted['line_items'])} line items."})

        actions = [
            "Flag invoice discrepancy with vendor before payment approval." if not extracted["math_ok"] else "Approve verified invoice JSON for accounting import.",
        ]
        summary = (
            f"Parsed invoice {extracted['invoice_number'] or 'unknown'} "
            f"({len(extracted['line_items'])} line items, total={extracted['total']}); "
            f"math verification {'passed' if extracted['math_ok'] else 'failed'}."
        )
        return {"summary": summary, "findings": findings, "actions": actions, "metadata": extracted}


class ContractAgent(BaseAgent):
    agent_id = "contract"
    name = "Contract Review Agent"
    category = "Legal"
    description = "Scans agreements for auto-renewal traps, uncapped liability, IP transfer, and termination clauses."
    tools_used = ["read_document", "scan_risk_clauses"]

    RISK_RULES = [
        ("high", "Automatic renewal", re.compile(r"(?i)auto(?:matically)?\s+renew|evergreen"), "Check notice window to avoid locked-in annual renewals."),
        ("high", "Unlimited liability", re.compile(r"(?i)unlimited\s+liability|indemnify\s+against\s+all\s+claims"), "Negotiate a liability cap tied to 12 months of fees."),
        ("medium", "Unilateral price increase", re.compile(r"(?i)increase\s+fees?\s+at\s+any\s+time|sole\s+discretion.{0,30}price"), "Add an annual price-increase cap (for example 5%) and 60-day notice."),
        ("medium", "Broad IP assignment", re.compile(r"(?i)assigns?\s+all\s+intellectual\s+property|work\s+made\s+for\s+hire"), "Carve out pre-existing tools and open-source libraries."),
        ("medium", "Short termination notice", re.compile(r"(?i)terminate\s+immediately\s+without\s+cause"), "Request mutual 30-day termination for convenience."),
        ("low", "Governing law / arbitration", re.compile(r"(?i)binding\s+arbitration|governing\s+law"), "Confirm jurisdiction and dispute venue are acceptable."),
    ]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = self.run_step(
            "Load contract text",
            "read_document",
            lambda: _read_text_payload(payload),
            lambda t: f"Loaded {len(t.split())} words",
        )

        def _scan() -> list[dict[str, Any]]:
            hits = []
            for severity, title, pattern, advice in self.RISK_RULES:
                match = pattern.search(text)
                if match:
                    start = max(0, match.start() - 40)
                    end = min(len(text), match.end() + 80)
                    excerpt = " ".join(text[start:end].split())
                    hits.append(
                        {
                            "severity": severity,
                            "title": title,
                            "detail": f"Matched: \"{excerpt}\" — {advice}",
                            "advice": advice,
                        }
                    )
            return hits

        hits = self.run_step(
            "Scan clauses against risk rules",
            "scan_risk_clauses",
            _scan,
            lambda h: f"Detected {len(h)} clauses requiring review",
        )
        actions = [h["advice"] for h in hits] or ["No high-risk clauses matched built-in rules; confirm payment terms with counsel."]
        summary = f"Reviewed contract ({len(text.split())} words) and flagged {len(hits)} clause risk(s) ({sum(1 for h in hits if h['severity'] == 'high')} high)."
        return {"summary": summary, "findings": hits, "actions": actions, "metadata": {"word_count": len(text.split())}}


class DataAnalysisAgent(BaseAgent):
    agent_id = "data-analysis"
    name = "Data & Spreadsheet Agent"
    category = "Analytics"
    description = "Profiles CSV/TSV datasets, computes summary statistics, detects outliers, and highlights data quality gaps."
    tools_used = ["read_dataset", "analyze_csv_text"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        csv_text = self.run_step(
            "Load CSV dataset",
            "read_dataset",
            lambda: _read_text_payload(payload),
            lambda t: f"Loaded {len(t.splitlines())} lines",
        )
        profile = self.run_step(
            "Profile columns and detect anomalies",
            "analyze_csv_text",
            lambda: analyze_csv_text(csv_text),
            lambda p: f"{p['rows']} rows x {len(p['columns'])} cols, {len(p['numeric_stats'])} numeric cols, {len(p['anomalies'])} outliers",
        )
        findings: list[dict[str, Any]] = []
        for col, stats in profile["numeric_stats"].items():
            findings.append(
                {
                    "severity": "info",
                    "title": f"Metric column: {col}",
                    "detail": f"sum={stats['sum']}, mean={stats['mean']}, median={stats['median']}, min={stats['min']}, max={stats['max']}",
                }
            )
        for anom in profile["anomalies"][:5]:
            findings.append(
                {
                    "severity": "medium",
                    "title": f"Outlier in {anom['column']} (row {anom['row']})",
                    "detail": f"Value {anom['value']} has z-score {anom['z_score']}.",
                }
            )
        missing_cols = {k: v for k, v in profile.get("missing_counts", {}).items() if v > 0}
        if missing_cols:
            findings.append({"severity": "medium", "title": "Missing values detected", "detail": str(missing_cols)})

        actions = [
            "Investigate z-score outliers to confirm whether they are real spikes or logging errors." if profile["anomalies"] else "Dataset has no extreme z-score outliers; ready for dashboarding.",
            "Backfill or drop rows with missing cells before training models." if missing_cols else "No missing cells detected across analyzed columns.",
        ]
        summary = (
            f"Analyzed {profile['rows']} rows across {len(profile['columns'])} columns "
            f"({len(profile['numeric_stats'])} numeric metrics, {len(profile['anomalies'])} outliers)."
        )
        return {"summary": summary, "findings": findings, "actions": actions, "metadata": profile}
