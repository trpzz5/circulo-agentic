import './DecisionSummary.css'

export default function DecisionSummary({ decision }) {
  if (!decision) {
    return (
      <div className="decision-summary panel decision-summary--empty">
        <span className="label-caps">Recommended Route</span>
        <p className="decision-summary__placeholder">Awaiting the Decision Agent…</p>
      </div>
    )
  }

  return (
    <div className="decision-summary panel">
      <div className="decision-summary__header">
        <span className="label-caps">Recommended Route</span>
        <span className="decision-summary__confidence">
          CONFIDENCE {(decision.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="decision-summary__route mono">
        {decision.recommended_route_id || 'NO VIABLE ROUTE FOUND'}
      </div>

      {decision.rejected_routes?.length > 0 && (
        <div className="decision-summary__section">
          <span className="label-caps">Rejected Candidates</span>
          <ul>
            {decision.rejected_routes.map((r) => (
              <li key={r.factory_id}>
                <strong>{r.factory_name}</strong> — {r.reasons.join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="decision-summary__section">
        <span className="label-caps">Agent Debate</span>
        <ol>
          {decision.debate?.map((line, i) => <li key={i}>{line}</li>)}
        </ol>
      </div>
    </div>
  )
}