import './DecisionSummary.css'

function formatConfidence(confidence) {
  if (typeof confidence !== 'number') return '—'
  return `${(confidence * 100).toFixed(0)}%`
}

export default function DecisionSummary({ decision }) {
  if (!decision) {
    return (
      <div className="decision-summary panel decision-summary--empty">
        <span className="label-caps">Decision Engine</span>

        <div className="decision-summary__empty-icon">
          ◇
        </div>

        <p className="decision-summary__placeholder">
          Awaiting the Decision Agent…
        </p>

        <span className="decision-summary__empty-note mono">
          RUN ANALYSIS TO GENERATE ROUTE
        </span>
      </div>
    )
  }

  const confidence = formatConfidence(decision.confidence)

  const rejectedRoutes = decision.rejected_routes || []
  const debate = decision.debate || []

  return (
    <div className="decision-summary panel">
      <div className="decision-summary__header">
        <div>
          <span className="label-caps">Decision Engine</span>

          <div className="decision-summary__state">
            <span className="decision-summary__state-dot" />
            DECISION COMPLETE
          </div>
        </div>

        <span className="decision-summary__confidence">
          CONFIDENCE {confidence}
        </span>
      </div>

      <div className="decision-summary__route mono">
        {decision.recommended_route_id || 'NO VIABLE ROUTE FOUND'}
      </div>

      <div className="decision-summary__metrics">
        <div className="decision-summary__metric">
          <span className="label-caps">Confidence</span>
          <strong>{confidence}</strong>
        </div>

        <div className="decision-summary__metric">
          <span className="label-caps">Alternatives</span>
          <strong>{rejectedRoutes.length}</strong>
        </div>

        <div className="decision-summary__metric">
          <span className="label-caps">Debate Signals</span>
          <strong>{debate.length}</strong>
        </div>
      </div>

      {rejectedRoutes.length > 0 && (
        <div className="decision-summary__section">
          <div className="decision-summary__section-heading">
            <span className="label-caps">Rejected Candidates</span>
            <span className="decision-summary__section-count mono">
              {String(rejectedRoutes.length).padStart(2, '0')}
            </span>
          </div>

          <ul>
            {rejectedRoutes.map((route, index) => (
              <li key={route.factory_id || index}>
                <strong>{route.factory_name}</strong>

                {route.reasons?.length > 0 && (
                  <span className="decision-summary__reason">
                    {route.reasons.join('; ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {debate.length > 0 && (
        <div className="decision-summary__section">
          <div className="decision-summary__section-heading">
            <span className="label-caps">Agent Debate</span>
            <span className="decision-summary__section-count mono">
              {String(debate.length).padStart(2, '0')}
            </span>
          </div>

          <ol>
            {debate.map((line, index) => (
              <li key={index}>
                {line}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}