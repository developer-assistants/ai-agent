"""Multi-step agent execution engine with tool tracing and verification."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any, Callable

from ai_agent.llm import LLMClient
from ai_agent.memory import AgentMemory


@dataclass
class StepRecord:
    index: int
    name: str
    tool: str
    duration_ms: float
    status: str
    summary: str
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    agent_id: str
    agent_name: str
    status: str
    summary: str
    findings: list[dict[str, Any]]
    actions: list[str]
    steps: list[StepRecord]
    verified: bool
    verification_notes: list[str]
    mode: str
    run_id: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "status": self.status,
            "summary": self.summary,
            "findings": self.findings,
            "actions": self.actions,
            "steps": [asdict(step) for step in self.steps],
            "verified": self.verified,
            "verification_notes": self.verification_notes,
            "mode": self.mode,
            "run_id": self.run_id,
            "metadata": self.metadata,
        }

    def to_markdown(self) -> str:
        lines = [
            f"# {self.agent_name} report",
            "",
            f"- Agent ID: `{self.agent_id}`",
            f"- Status: `{self.status}`",
            f"- Verified: `{self.verified}`",
            f"- Execution mode: `{self.mode}`",
        ]
        if self.run_id is not None:
            lines.append(f"- Run ID: `{self.run_id}`")
        lines.extend(["", "## Summary", "", self.summary, "", "## Execution trace", ""])
        for step in self.steps:
            lines.append(
                f"{step.index}. `{step.tool}` ({step.duration_ms:.1f} ms): {step.summary}"
            )
        lines.extend(["", "## Findings", ""])
        if not self.findings:
            lines.append("No issues or items were recorded.")
        for item in self.findings:
            severity = item.get("severity", "info")
            title = item.get("title", "Finding")
            detail = item.get("detail", "")
            lines.append(f"- [{severity}] {title}: {detail}")
        lines.extend(["", "## Recommended actions", ""])
        for action in self.actions:
            lines.append(f"- {action}")
        lines.extend(["", "## Verification checks", ""])
        for note in self.verification_notes:
            lines.append(f"- {note}")
        lines.append("")
        return "\n".join(lines)


class BaseAgent(ABC):
    """Base class for all multi-step agents in the hub."""

    agent_id: str = ""
    name: str = ""
    category: str = ""
    description: str = ""
    tools_used: list[str] = []

    def __init__(
        self,
        memory: AgentMemory | None = None,
        llm: LLMClient | None = None,
    ) -> None:
        self.memory = memory or AgentMemory()
        self.llm = llm or LLMClient()
        self._steps: list[StepRecord] = []

    def run_step(
        self,
        name: str,
        tool: str,
        fn: Callable[[], Any],
        summarizer: Callable[[Any], str] | None = None,
    ) -> Any:
        start = time.perf_counter()
        try:
            result = fn()
            elapsed = (time.perf_counter() - start) * 1000.0
            summary = summarizer(result) if summarizer else f"Completed {name}"
            evidence = result if isinstance(result, dict) else {"value": str(result)[:300]}
            self._steps.append(
                StepRecord(
                    index=len(self._steps) + 1,
                    name=name,
                    tool=tool,
                    duration_ms=round(elapsed, 2),
                    status="ok",
                    summary=summary,
                    evidence=evidence,
                )
            )
            return result
        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000.0
            self._steps.append(
                StepRecord(
                    index=len(self._steps) + 1,
                    name=name,
                    tool=tool,
                    duration_ms=round(elapsed, 2),
                    status="error",
                    summary=f"Failed: {exc}",
                    evidence={"error": str(exc)},
                )
            )
            raise

    def verify(
        self,
        summary: str,
        findings: list[dict[str, Any]],
        actions: list[str],
    ) -> tuple[bool, list[str]]:
        notes: list[str] = []
        passed = True
        if len(self._steps) >= 2:
            notes.append(f"Multi-step trace recorded ({len(self._steps)} steps).")
        else:
            passed = False
            notes.append("Expected at least 2 execution steps.")
        if summary.strip():
            notes.append("Summary present.")
        else:
            passed = False
            notes.append("Summary is empty.")
        if actions:
            notes.append(f"{len(actions)} actionable next steps generated.")
        else:
            passed = False
            notes.append("No actionable next steps generated.")
        if any(step.status == "error" for step in self._steps):
            passed = False
            notes.append("One or more tool steps reported an error.")
        else:
            notes.append("All tool calls exited with status ok.")
        return passed, notes

    def execute(self, payload: dict[str, Any]) -> AgentResult:
        self._steps = []
        output = self._run(payload)
        summary = output["summary"]
        findings = output.get("findings", [])
        actions = output.get("actions", [])
        metadata = output.get("metadata", {})
        mode = output.get("mode", "local-deterministic")

        verified, verification_notes = self.verify(summary, findings, actions)
        result = AgentResult(
            agent_id=self.agent_id,
            agent_name=self.name,
            status="completed" if verified else "needs_review",
            summary=summary,
            findings=findings,
            actions=actions,
            steps=list(self._steps),
            verified=verified,
            verification_notes=verification_notes,
            mode=mode,
            metadata=metadata,
        )
        input_summary = str(payload.get("input") or payload.get("url") or payload.get("file") or "")
        run_id = self.memory.save_run(
            agent_id=self.agent_id,
            status=result.status,
            verified=result.verified,
            input_summary=input_summary,
            summary=result.summary,
            payload=result.to_dict(),
        )
        result.run_id = run_id
        return result

    @abstractmethod
    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Implement agent-specific multi-step logic."""
