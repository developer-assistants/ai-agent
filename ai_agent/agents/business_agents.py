"""Business workflow agents: Sales lead research, Email triage, and Customer Support."""

from __future__ import annotations

import json
import re
from typing import Any

from ai_agent.engine import BaseAgent
from ai_agent.tools.builtin import search_knowledge_base

DEFAULT_KB = [
    {
        "id": "kb-pricing",
        "title": "Pricing and self-hosting policy",
        "body": "The open-source CLI and all 12 agents are free under the MIT license when self-hosted with your own API key or local Ollama model. Managed cloud plans cover scheduled runs, team history, and Slack/webhook alerts.",
    },
    {
        "id": "kb-docker",
        "title": "Running with Docker",
        "body": "Run docker compose up to start the local web hub and REST API on port 8080. Persistent run history is stored in a mounted SQLite volume at /data/memory.db.",
    },
    {
        "id": "kb-privacy",
        "title": "Data privacy and offline mode",
        "body": "All deterministic tools run locally without sending data to external servers. When OPENAI_API_KEY is unset, agents stay in local-deterministic mode.",
    },
]


class SalesAgent(BaseAgent):
    agent_id = "sales"
    name = "Lead Research & Sales Agent"
    category = "Sales"
    description = "Qualifies target accounts, scores ICP fit, and prepares tailored outreach notes."
    tools_used = ["parse_lead_profile", "score_icp_fit", "draft_outreach"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = str(payload.get("input", "")).strip()

        def _parse_lead() -> dict[str, Any]:
            company = re.search(r"(?i)company\s*:\s*(.+)", raw)
            role = re.search(r"(?i)(?:role|title)\s*:\s*(.+)", raw)
            size = re.search(r"(?i)(?:size|employees)\s*:\s*(\d+)", raw)
            pain = re.search(r"(?i)(?:pain|signal|need)\s*:\s*(.+)", raw)
            return {
                "company": company.group(1).strip() if company else (raw.splitlines()[0][:60] if raw else "Target Account"),
                "role": role.group(1).strip() if role else "Operations Lead",
                "employees": int(size.group(1)) if size else 50,
                "signal": pain.group(1).strip() if pain else raw[:180],
            }

        profile = self.run_step(
            "Parse lead context",
            "parse_lead_profile",
            _parse_lead,
            lambda p: f"Identified {p['company']} ({p['role']}, ~{p['employees']} staff)",
        )

        def _score_icp() -> dict[str, Any]:
            score = 50
            reasons: list[str] = []
            if 10 <= profile["employees"] <= 500:
                score += 25
                reasons.append("Company size fits core mid-market automation tier (10 to 500 staff).")
            if any(k in profile["signal"].lower() for k in ("manual", "audit", "report", "workflow", "seo", "invoice", "support")):
                score += 20
                reasons.append("Explicit operational pain matches ready-to-run agent templates.")
            else:
                reasons.append("General signal detected; confirm specific workflow bottleneck on discovery call.")
            tier = "A (High fit)" if score >= 80 else ("B (Qualified)" if score >= 65 else "C (Nurture)")
            return {"score": min(100, score), "tier": tier, "reasons": reasons}

        icp = self.run_step(
            "Score ICP qualification",
            "score_icp_fit",
            _score_icp,
            lambda s: f"ICP score {s['score']}/100 ({s['tier']})",
        )

        def _draft() -> dict[str, str]:
            subject = f"Automating {profile['company']}'s workflow without vendor lock-in"
            body = (
                f"Hi {profile['role']},\n\n"
                f"Noticed {profile['company']} is dealing with: {profile['signal']}.\n"
                f"We maintain an open-source hub of self-hosted AI agents with traceable tool steps and SQLite run logs. "
                f"Teams of ~{profile['employees']} usually start with one local workflow in Docker before automating alerts.\n\n"
                f"Happy to share the exact agent config if useful."
            )
            return {"subject": subject, "body": body}

        draft = self.run_step(
            "Prepare personalized outreach",
            "draft_outreach",
            _draft,
            lambda d: f"Drafted email with subject '{d['subject']}'",
        )

        findings = [
            {"severity": "info", "title": f"Qualification tier: {icp['tier']}", "detail": " ".join(icp["reasons"])},
            {"severity": "info", "title": "Outreach subject", "detail": draft["subject"]},
        ]
        actions = [
            "Verify contact email and LinkedIn activity before sending.",
            "Attach a relevant sample report matching the lead's workflow signal.",
        ]
        return {
            "summary": f"Qualified {profile['company']} at {icp['score']}/100 ({icp['tier']}) and drafted personalized outreach.",
            "findings": findings,
            "actions": actions,
            "metadata": {"profile": profile, "icp": icp, "draft": draft},
        }


class EmailAgent(BaseAgent):
    agent_id = "email"
    name = "Email Triage Agent"
    category = "Productivity"
    description = "Classifies inbox messages by urgency, extracts action items, and drafts concise replies."
    tools_used = ["parse_messages", "classify_priority", "extract_actions"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        raw = str(payload.get("input", "")).strip()

        def _parse() -> list[dict[str, str]]:
            try:
                data = json.loads(raw)
                if isinstance(data, list):
                    return [
                        {
                            "from": str(m.get("from", "unknown")),
                            "subject": str(m.get("subject", "(no subject)")),
                            "body": str(m.get("body", "")),
                        }
                        for m in data
                    ]
            except json.JSONDecodeError:
                pass
            blocks = [b.strip() for b in raw.split("\n---\n") if b.strip()]
            messages = []
            for block in blocks or [raw]:
                lines = block.splitlines()
                subject = lines[0].replace("Subject:", "").strip() if lines else "(no subject)"
                messages.append({"from": "sender", "subject": subject, "body": "\n".join(lines[1:]) or block})
            return messages

        messages = self.run_step(
            "Parse inbox payload",
            "parse_messages",
            _parse,
            lambda msgs: f"Parsed {len(msgs)} email threads",
        )

        def _classify() -> list[dict[str, Any]]:
            results = []
            for msg in messages:
                text = f"{msg['subject']} {msg['body']}".lower()
                if any(w in text for w in ("urgent", "outage", "invoice overdue", "security", "down", "asap")):
                    priority = "high"
                    bucket = "Respond today"
                elif any(w in text for w in ("meeting", "proposal", "review", "contract", "question")):
                    priority = "medium"
                    bucket = "Action needed"
                else:
                    priority = "low"
                    bucket = "Newsletter / FYI"
                results.append({**msg, "priority": priority, "bucket": bucket})
            return results

        triaged = self.run_step(
            "Classify urgency and folders",
            "classify_priority",
            _classify,
            lambda items: f"Triaged {sum(1 for i in items if i['priority'] == 'high')} high-priority threads",
        )
        high_items = [item for item in triaged if item["priority"] == "high"]
        findings = [
            {
                "severity": item["priority"],
                "title": f"[{item['bucket']}] {item['subject']}",
                "detail": f"From {item['from']}: {item['body'][:140]}",
            }
            for item in triaged
        ]
        actions = [
            f"Reply first to {len(high_items)} high-priority message(s)." if high_items else "No urgent fires; process medium-priority replies in one batch.",
            "Archive low-priority newsletters and digest updates.",
        ]
        return {
            "summary": f"Triaged {len(triaged)} messages: {len(high_items)} high priority, {sum(1 for i in triaged if i['priority'] == 'medium')} medium, {sum(1 for i in triaged if i['priority'] == 'low')} low.",
            "findings": findings,
            "actions": actions,
            "metadata": {"messages": triaged},
        }


class SupportAgent(BaseAgent):
    agent_id = "support"
    name = "Customer Support Agent"
    category = "Operations"
    description = "Answers user questions grounded in local knowledge-base articles with source citations."
    tools_used = ["search_knowledge_base", "compose_grounded_reply"]

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        question = str(payload.get("input", "")).strip()
        kb = payload.get("kb") or DEFAULT_KB

        matches = self.run_step(
            "Search knowledge base",
            "search_knowledge_base",
            lambda: search_knowledge_base(question, kb, top_k=3),
            lambda hits: f"Matched {len(hits)} KB articles (top score {hits[0]['score'] if hits else 0})",
        )

        def _compose() -> dict[str, Any]:
            if not matches or matches[0]["score"] < 0.15:
                return {
                    "escalate": True,
                    "answer": "No high-confidence article matched this question. Escalate to a human support engineer.",
                    "citations": [],
                }
            top = matches[0]
            return {
                "escalate": False,
                "answer": f"Based on '{top['title']}' ({top['id']}): {top['excerpt']}",
                "citations": [m["id"] for m in matches],
            }

        reply = self.run_step(
            "Compose cited response",
            "compose_grounded_reply",
            _compose,
            lambda r: "Prepared grounded answer" if not r["escalate"] else "Flagged for human escalation",
        )
        findings = [
            {
                "severity": "medium" if reply["escalate"] else "info",
                "title": "Escalation required" if reply["escalate"] else f"Cited source: {matches[0]['id']}",
                "detail": reply["answer"],
            }
        ]
        actions = [
            "Send the grounded reply with article links." if not reply["escalate"] else "Route ticket to tier-2 support and add a new KB entry once resolved.",
        ]
        return {
            "summary": reply["answer"],
            "findings": findings,
            "actions": actions,
            "metadata": {"matches": matches, "reply": reply},
        }
