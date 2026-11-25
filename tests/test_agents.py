"""Unit tests for the AI Agent Hub engine, memory store, all 12 agents, and CLI."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ai_agent.agents import AGENT_REGISTRY, get_agent_class, list_agents
from ai_agent.cli import main as cli_main
from ai_agent.memory import AgentMemory

EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"


class TestAgentHub(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "test_memory.db"
        self.memory = AgentMemory(db_path=self.db_path)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_registry_has_12_agents(self) -> None:
        agents = list_agents()
        self.assertEqual(len(agents), 12)
        self.assertEqual(len(AGENT_REGISTRY), 12)

    def test_seo_agent_audits_html_file(self) -> None:
        agent = get_agent_class("seo")(memory=self.memory)
        result = agent.execute({"file": str(EXAMPLES_DIR / "sample_page.html")})
        self.assertTrue(result.verified)
        self.assertLess(result.metadata["score"], 100)
        titles = [f["title"] for f in result.findings]
        self.assertIn("Missing meta description", titles)
        self.assertIn("H1 count issue", titles)

    def test_document_agent_verifies_invoice_math(self) -> None:
        agent = get_agent_class("document")(memory=self.memory)
        result = agent.execute({"file": str(EXAMPLES_DIR / "sample_invoice.txt")})
        self.assertTrue(result.verified)
        self.assertEqual(result.metadata["invoice_number"], "INV-2026-0418")
        self.assertTrue(result.metadata["math_ok"])
        self.assertEqual(result.metadata["total"], 1980.0)

    def test_contract_agent_flags_high_risk_clauses(self) -> None:
        agent = get_agent_class("contract")(memory=self.memory)
        result = agent.execute({"file": str(EXAMPLES_DIR / "sample_contract.txt")})
        self.assertTrue(result.verified)
        titles = [f["title"] for f in result.findings]
        self.assertIn("Automatic renewal", titles)
        self.assertIn("Unlimited liability", titles)

    def test_data_analysis_agent_detects_outlier(self) -> None:
        agent = get_agent_class("data-analysis")(memory=self.memory)
        result = agent.execute({"file": str(EXAMPLES_DIR / "sample_metrics.csv")})
        self.assertTrue(result.verified)
        self.assertEqual(result.metadata["rows"], 10)
        self.assertTrue(len(result.metadata["anomalies"]) >= 1)

    def test_coding_agent_detects_security_issues(self) -> None:
        agent = get_agent_class("coding")(memory=self.memory)
        sample = 'api_key = "sk-live-1234567890"\ntry:\n    eval("1+1")\nexcept:\n    pass\n'
        result = agent.execute({"input": sample})
        self.assertTrue(result.verified)
        titles = [f["title"] for f in result.findings]
        self.assertIn("Potential hardcoded secret", titles)
        self.assertIn("Dynamic code execution", titles)

    def test_competitor_agent_persists_and_diffs_baseline(self) -> None:
        agent = get_agent_class("competitor")(memory=self.memory)
        first = agent.execute({"target": "acme", "input": "Starter $19/mo\nBusiness $49/mo"})
        self.assertTrue(first.verified)
        second = agent.execute({"target": "acme", "input": "Starter $29/mo\nBusiness $49/mo\nEnterprise $149/mo"})
        self.assertTrue(second.verified)
        self.assertGreater(second.metadata["diff"]["added_count"], 0)

    def test_remaining_agents_execute_and_log_memory(self) -> None:
        cases = {
            "sales": {"input": "Company: Northstar Ops\nRole: Head of Ops\nEmployees: 85\nPain: Manual invoice audits every week"},
            "email": {"input": json.dumps([{"from": "ops@acme.io", "subject": "URGENT: API outage", "body": "Latency spiked"}])},
            "support": {"input": "How do I run this with Docker?"},
            "browser": {"file": str(EXAMPLES_DIR / "sample_page.html")},
            "github": {"path": str(Path(__file__).resolve().parent.parent)},
            "research": {"input": "Self-hosted AI agent architectures"},
        }
        for agent_id, payload in cases.items():
            agent = get_agent_class(agent_id)(memory=self.memory)
            res = agent.execute(payload)
            self.assertTrue(res.verified, f"{agent_id} failed verification: {res.verification_notes}")
            self.assertGreaterEqual(len(res.steps), 2)

        runs = self.memory.list_runs(limit=20)
        self.assertEqual(len(runs), len(cases))

    def test_cli_list_and_run_json(self) -> None:
        out_file = Path(self.tmp.name) / "report.json"
        rc_list = cli_main(["--db", str(self.db_path), "list"])
        self.assertEqual(rc_list, 0)
        rc_run = cli_main(
            [
                "--db",
                str(self.db_path),
                "run",
                "document",
                "--file",
                str(EXAMPLES_DIR / "sample_invoice.txt"),
                "--format",
                "json",
                "--out",
                str(out_file),
            ]
        )
        self.assertEqual(rc_run, 0)
        data = json.loads(out_file.read_text(encoding="utf-8"))
        self.assertTrue(data["verified"])
        self.assertEqual(data["agent_id"], "document")


if __name__ == "__main__":
    unittest.main()
