"""Registry of all 12 built-in multi-step AI agents."""

from __future__ import annotations

from ai_agent.agents.business_agents import EmailAgent, SalesAgent, SupportAgent
from ai_agent.agents.document_agents import ContractAgent, DataAnalysisAgent, DocumentAgent
from ai_agent.agents.engineering_agents import CodingAgent, GitHubAgent, ResearchAgent
from ai_agent.agents.web_agents import BrowserAgent, CompetitorAgent, SEOAgent
from ai_agent.engine import BaseAgent

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "seo": SEOAgent,
    "research": ResearchAgent,
    "email": EmailAgent,
    "coding": CodingAgent,
    "sales": SalesAgent,
    "data-analysis": DataAnalysisAgent,
    "document": DocumentAgent,
    "contract": ContractAgent,
    "competitor": CompetitorAgent,
    "support": SupportAgent,
    "browser": BrowserAgent,
    "github": GitHubAgent,
}


def get_agent_class(agent_id: str) -> type[BaseAgent]:
    if agent_id not in AGENT_REGISTRY:
        available = ", ".join(sorted(AGENT_REGISTRY))
        raise KeyError(f"Unknown agent '{agent_id}'. Available agents: {available}")
    return AGENT_REGISTRY[agent_id]


def list_agents() -> list[dict[str, object]]:
    return [
        {
            "id": cls.agent_id,
            "name": cls.name,
            "category": cls.category,
            "description": cls.description,
            "tools": list(cls.tools_used),
        }
        for cls in AGENT_REGISTRY.values()
    ]
