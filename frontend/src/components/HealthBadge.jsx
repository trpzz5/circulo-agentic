import { useEffect, useState } from 'react'
import { getHealth } from '../services/api.js'
import './HealthBadge.css'

export default function HealthBadge() {
  const [health, setHealth] = useState(null)

  useEffect(() => {
    let cancelled = false
    getHealth()
      .then((data) => { if (!cancelled) setHealth(data) })
      .catch(() => { if (!cancelled) setHealth({ status: 'unreachable' }) })
    return () => { cancelled = true }
  }, [])

  if (!health) return <div className="health-badge health-badge--pending">CHECKING…</div>

  const ok = health.status === 'ok'
  return (
    <div className={`health-badge ${ok ? 'health-badge--ok' : 'health-badge--degraded'}`}>
      <span className="health-dot" />
      {ok ? 'SYSTEM NOMINAL' : 'SYSTEM DEGRADED'}
      {health.deterministic_mode && <span className="health-chip">DETERMINISTIC MODE</span>}
    </div>
  )
}