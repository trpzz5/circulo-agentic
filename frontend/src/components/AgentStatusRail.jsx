import './AgentStatusRail.css'

const AGENTS = [
  {
    key: 'dna',
    number: '01',
    name: 'DNA Agent',
    role: 'Material characterization',
  },
  {
    key: 'discovery',
    number: '02',
    name: 'Discovery Agent',
    role: 'Industrial route discovery',
  },
  {
    key: 'impact',
    number: '03',
    name: 'Impact Agent',
    role: 'Economic + environmental scoring',
  },
  {
    key: 'decision',
    number: '04',
    name: 'Decision Agent',
    role: 'Route selection',
  },
]

function getStatusLabel(status) {
  switch (status) {
    case 'complete':
      return 'COMPLETE'
    case 'running':
      return 'RUNNING'
    case 'failed':
      return 'FAILED'
    case 'pending':
      return 'QUEUED'
    default:
      return 'IDLE'
  }
}

function getStatusClass(status) {
  return `agent-status-rail__stage--${
    status || 'idle'
  }`
}

function getPipelineState(agents) {
  const statuses = AGENTS.map(
    ({ key }) => agents?.[key]?.status || 'idle'
  )

  if (statuses.includes('failed')) {
    return 'failed'
  }

  if (statuses.includes('running')) {
    return 'running'
  }

  if (
    statuses.every(
      (status) => status === 'complete'
    )
  ) {
    return 'complete'
  }

  if (
    statuses.some(
      (status) =>
        status === 'complete' ||
        status === 'pending'
    )
  ) {
    return 'running'
  }

  return 'idle'
}

function getCompletedCount(agents) {
  return AGENTS.filter(
    ({ key }) =>
      agents?.[key]?.status === 'complete'
  ).length
}

export default function AgentStatusRail({
  agents = {},
}) {
  const completedCount =
    getCompletedCount(agents)

  const pipelineState =
    getPipelineState(agents)

  const progress =
    (completedCount / AGENTS.length) * 100

  return (
    <section className="agent-status-rail panel">
      <header className="agent-status-rail__header">
        <div className="agent-status-rail__heading">
          <div className="agent-status-rail__eyebrow label-caps">
            Agent Orchestration
          </div>

          <h2 className="agent-status-rail__title">
            Autonomous execution
          </h2>
        </div>

        <div
          className={`agent-status-rail__progress-status agent-status-rail__progress-status--${pipelineState}`}
        >
          <span className="agent-status-rail__progress-count mono">
            {String(completedCount).padStart(2, '0')}
            <span className="agent-status-rail__progress-divider">
              /
            </span>
            {String(AGENTS.length).padStart(2, '0')}
          </span>

          <span className="agent-status-rail__progress-label mono">
            {pipelineState === 'complete'
              ? 'COMPLETE'
              : pipelineState === 'failed'
                ? 'FAILED'
                : pipelineState === 'running'
                  ? 'RUNNING'
                  : 'STANDBY'}
          </span>
        </div>
      </header>

      <div className="agent-status-rail__progress-track">
        <span
          className="agent-status-rail__progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="agent-status-rail__flow">
        {AGENTS.map(
          (
            {
              key,
              number,
              name,
              role,
            },
            index
          ) => {
            const agent = agents?.[key] || {}

            const status =
              agent.status || 'idle'

            const statusLabel =
              getStatusLabel(status)

            const isLast =
              index === AGENTS.length - 1

            return (
              <div
                className="agent-status-rail__flow-item"
                key={key}
              >
                <article
                  className={`agent-status-rail__stage ${getStatusClass(
                    status
                  )}`}
                >
                  <div className="agent-status-rail__stage-top">
                    <span className="agent-status-rail__stage-number mono">
                      {number}
                    </span>

                    <span className="agent-status-rail__stage-status mono">
                      <span className="agent-status-rail__status-dot" />
                      {statusLabel}
                    </span>
                  </div>

                  <div className="agent-status-rail__stage-body">
                    <div className="agent-status-rail__stage-name">
                      {name}
                    </div>

                    <div className="agent-status-rail__stage-role">
                      {role}
                    </div>
                  </div>

                  <div className="agent-status-rail__stage-divider" />

                  <div className="agent-status-rail__stage-activity">
                    <span className="agent-status-rail__activity-label label-caps">
                      CURRENT ACTIVITY
                    </span>

                    <span className="agent-status-rail__activity-value">
                      {agent.activity ||
                        statusLabel}
                    </span>
                  </div>

                  {agent.note && (
                    <div className="agent-status-rail__stage-note">
                      {agent.note}
                    </div>
                  )}
                </article>

                {!isLast && (
                  <div className="agent-status-rail__connector">
                    <span className="agent-status-rail__connector-line" />
                    <span className="agent-status-rail__connector-arrow">
                      →
                    </span>
                  </div>
                )}
              </div>
            )
          }
        )}
      </div>

      <footer className="agent-status-rail__footer">
        <span className="agent-status-rail__footer-dot" />

        <span className="mono">
          {pipelineState === 'complete'
            ? 'PIPELINE EXECUTION COMPLETE'
            : pipelineState === 'failed'
              ? 'PIPELINE EXECUTION FAILED'
              : pipelineState === 'running'
                ? 'PIPELINE EXECUTION IN PROGRESS'
                : 'PIPELINE READY'}
        </span>

        <span className="agent-status-rail__footer-path mono">
          DNA → DISCOVERY → IMPACT → DECISION
        </span>
      </footer>
    </section>
  )
}