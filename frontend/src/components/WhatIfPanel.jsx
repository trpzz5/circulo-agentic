import { useEffect, useRef, useState } from 'react'
import { simulateWhatIf } from '../services/api.js'
import './WhatIfPanel.css'

const DEBOUNCE_MS = 350

function isDifferent(a, b) {
  return (
    a.quantity_tonnes_per_month !== b.quantity_tonnes_per_month ||
    a.moisture_percent !== b.moisture_percent ||
    a.purity_percent !== b.purity_percent
  )
}

/**
 * Lets the user drag quantity/moisture/purity away from the real manifest
 * and see, within a few hundred ms, how the recommended route changes —
 * without ever touching persistent memory (enforced server-side; see
 * backend/app/agents/decision_agent.py).
 */
export default function WhatIfPanel({ wasteDna, maxHops, onResult, onReset }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  // Whenever a fresh real analysis completes, sync the draft to it.
  useEffect(() => {
    if (wasteDna) setDraft(wasteDna)
  }, [wasteDna])

  useEffect(() => {
    if (!draft || !wasteDna || !isDifferent(draft, wasteDna)) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const thisRequest = ++requestIdRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await simulateWhatIf({ wasteDna: draft, maxHops })
        if (thisRequest === requestIdRef.current) onResult(result)
      } catch (err) {
        if (thisRequest === requestIdRef.current) setError(err.message || 'Simulation failed.')
      } finally {
        if (thisRequest === requestIdRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, maxHops])

  if (!wasteDna || !draft) {
    return (
      <div className="what-if panel what-if--empty">
        <span className="label-caps">What-If Simulator</span>
        <p className="what-if__placeholder">Run an analysis first to explore variations.</p>
      </div>
    )
  }

  const field = (key, label, unit, { min, max, step }) => (
    <label className="what-if__field" key={key}>
      <div className="what-if__field-header">
        <span>{label}</span>
        <span className="mono">{draft[key]}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
      />
    </label>
  )

  const dirty = isDifferent(draft, wasteDna)

  return (
    <div className="what-if panel">
      <div className="what-if__header">
        <span className="label-caps">What-If Simulator</span>
        {loading && <span className="what-if__status">RECOMPUTING…</span>}
      </div>

      {field('quantity_tonnes_per_month', 'Quantity', ' t/mo', { min: 1, max: 200, step: 1 })}
      {field('moisture_percent', 'Moisture', '%', { min: 0, max: 100, step: 0.5 })}
      {field('purity_percent', 'Purity', '%', { min: 0, max: 100, step: 0.5 })}

      {error && <div className="what-if__error">{error}</div>}

      <div className="what-if__footer">
        <span className="what-if__hint">
          {dirty ? 'Simulated — not saved to memory.' : 'Showing the actual analysis result.'}
        </span>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => {
            setDraft(wasteDna)
            onReset?.()
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}