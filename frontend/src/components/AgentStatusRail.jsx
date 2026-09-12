import "./AgentStatusRail.css";

const AGENT_META = {
  dna: {
    number: "01",
    name: "DNA Agent",
    shortName: "DNA",
    description: "Understands the waste",
    detail: "Extracts material properties from the manifest",
  },
  discovery: {
    number: "02",
    name: "Discovery Agent",
    shortName: "DISCOVERY",
    description: "Finds circular routes",
    detail: "Searches buyers, processors and multi-hop pathways",
  },
  impact: {
    number: "03",
    name: "Impact Agent",
    shortName: "IMPACT",
    description: "Measures route impact",
    detail: "Evaluates ecosystem value and environmental impact",
  },
  decision: {
    number: "04",
    name: "Decision Agent",
    shortName: "DECISION",
    description: "Selects the best route",
    detail: "Compares viable routes using value and memory",
  },
};

const AGENT_ORDER = ["dna", "discovery", "impact", "decision"];

function normalizeKey(agent) {
  const value = String(
    agent?.id ??
    agent?.name ??
    agent?.agent ??
    agent?.type ??
    ""
  ).toLowerCase();

  if (value.includes("dna")) return "dna";
  if (value.includes("discovery")) return "discovery";
  if (value.includes("impact")) return "impact";
  if (value.includes("decision")) return "decision";

  return null;
}

function normalizeStatus(agent) {
  const value = String(
    agent?.status ??
    agent?.state ??
    agent?.phase ??
    "WAITING"
  ).toUpperCase();

  if (value.includes("RUN")) return "RUNNING";
  if (value.includes("COMPLETE") || value.includes("DONE")) {
    return "COMPLETE";
  }
  if (value.includes("FAIL") || value.includes("ERROR")) {
    return "FAILED";
  }
  if (value.includes("SKIP")) return "SKIPPED";

  return "WAITING";
}

function getStatusLabel(status) {
  switch (status) {
    case "RUNNING":
      return "PROCESSING";
    case "COMPLETE":
      return "COMPLETE";
    case "FAILED":
      return "FAILED";
    case "SKIPPED":
      return "SKIPPED";
    default:
      return "STANDBY";
  }
}

function getStatusMessage(status, agent) {
  if (agent?.message) return agent.message;
  if (agent?.detail) return agent.detail;

  switch (status) {
    case "RUNNING":
      return "Agent is processing...";
    case "COMPLETE":
      return "Execution complete";
    case "FAILED":
      return "Agent execution failed";
    case "SKIPPED":
      return "Waiting for upstream agent";
    default:
      return "Awaiting pipeline execution";
  }
}

export default function AgentStatusRail({ agents = [] }) {
  const agentMap = {};

  if (Array.isArray(agents)) {
    agents.forEach((agent) => {
      const key = normalizeKey(agent);

      if (key) {
        agentMap[key] = agent;
      }
    });
  } else if (agents && typeof agents === "object") {
    Object.entries(agents).forEach(([key, value]) => {
      const normalizedKey = normalizeKey({
        ...(value || {}),
        name: value?.name || key,
      });

      if (normalizedKey) {
        agentMap[normalizedKey] = value;
      }
    });
  }

  return (
    <section className="agent-pipeline panel">
      <div className="agent-pipeline__header">
        <div>
          <div className="agent-pipeline__eyebrow">
            Autonomous Pipeline
          </div>

          <h2 className="agent-pipeline__title">
            Agent Command Chain
          </h2>

          <p className="agent-pipeline__subtitle">
            Four deterministic agents working in sequence
          </p>
        </div>

        <div className="agent-pipeline__counter">
          <span className="agent-pipeline__counter-dot" />
          <span>4 AGENTS</span>
        </div>
      </div>

      <div className="agent-pipeline__track">
        {AGENT_ORDER.map((key, index) => {
          const meta = AGENT_META[key];
          const agent = agentMap[key];

          const status = normalizeStatus(agent);
          const statusLabel = getStatusLabel(status);
          const message = getStatusMessage(status, agent);

          return (
            <div
              className={`agent-card agent-card--${status.toLowerCase()}`}
              key={key}
            >
              <div className="agent-card__top">
                <div className="agent-card__number">
                  {meta.number}
                </div>

                <div className="agent-card__status">
                  <span className="agent-card__status-dot" />
                  {statusLabel}
                </div>
              </div>

              <div className="agent-card__body">
                <div className="agent-card__code">
                  {meta.shortName}
                </div>

                <h3 className="agent-card__name">
                  {meta.name}
                </h3>

                <p className="agent-card__description">
                  {meta.description}
                </p>
              </div>

              <div className="agent-card__footer">
                <span>{message}</span>
              </div>

              {index < AGENT_ORDER.length - 1 && (
                <div className="agent-connector">
                  <span className="agent-connector__line" />
                  <span className="agent-connector__arrow">→</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}