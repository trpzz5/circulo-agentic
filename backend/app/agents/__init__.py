"""Agent registry — the single place agents are instantiated.

Routes and the Phase 7 orchestrator both resolve agents from here, so an agent
is constructed once and its implementation can be swapped without touching
any caller.
"""

from __future__ import annotations

from app.agents.base import BaseAgent
from app.agents.decision_agent import DecisionAgent
from app.agents.discovery_agent import DiscoveryAgent
from app.agents.dna_agent import DNAAgent
from app.agents.impact_agent import ImpactAgent
from app.api.schemas.common import AgentName

dna_agent = DNAAgent()
discovery_agent = DiscoveryAgent()
impact_agent = ImpactAgent()
decision_agent = DecisionAgent()

AGENT_REGISTRY: dict[AgentName, BaseAgent] = {
    AgentName.DNA: dna_agent,
    AgentName.DISCOVERY: discovery_agent,
    AgentName.IMPACT: impact_agent,
    AgentName.DECISION: decision_agent,
}

# Canonical pipeline order — used by /api/analyze in Phase 7.
PIPELINE_ORDER: tuple[AgentName, ...] = (
    AgentName.DNA,
    AgentName.DISCOVERY,
    AgentName.IMPACT,
    AgentName.DECISION,
)

__all__ = [
    "AGENT_REGISTRY", "PIPELINE_ORDER", "BaseAgent",
    "dna_agent", "discovery_agent", "impact_agent", "decision_agent",
]