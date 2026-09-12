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

export default function WhatIfPanel({ wasteDna, maxHops, onResult, onReset }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

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
        const result = await simulateWhatIf({
          wasteDna: draft,
          maxHops,
        })

        if (thisRequest === requestIdRef.current) {
          onResult(result)
        }
      } catch (err) {
        if (thisRequest === requestIdRef.current) {
          setError(err.message || 'Simulation failed.')
        }
      } finally {
        if (thisRequest === requestIdRef.current) {
          setLoading(false)
        }
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, maxHops])

  if (!wasteDna || !draft) {
    return (
      <div className="what-if panel what-if--empty">
        <div className="what-if__empty-icon">
          <span />
        </div>

        <span className="label-caps">What-If Simulator</span>

        <p className="what-if__placeholder">
          Run an analysis first to explore material variations.
        </p>

        <span className="what-if__empty-note mono">
          SCENARIO ENGINE STANDBY
        </span>
      </div>
    )
  }

  const field = (
    key,
    label,
    unit,
    { min, max, step },
    description
  ) => {
    const value = draft[key]
    const percentage = ((value - min) / (max - min)) * 100

    return (
      <label className="what-if__field" key={key}>
        <div className="what-if__field-header">
          <div>
            <span className="what-if__field-label">{label}</span>
            <span className="what-if__field-description">
              {description}
            </span>
          </div>

          <span className="what-if__value mono">
            {value}
            {unit}
          </span>
        </div>

        <div className="what-if__slider-wrap">
          <div
            className="what-if__slider-fill"
            style={{ width: `${percentage}%` }}
          />

          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                [key]: Number(e.target.value),
              }))
            }
          />
        </div>

        <div className="what-if__range">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </label>
    )
  }

  const dirty = isDifferent(draft, wasteDna)

  return (
    <div className="what-if panel">
      <div className="what-if__header">
        <div>
          <div className="what-if__eyebrow">
            <span className="what-if__eyebrow-mark" />
            SCENARIO CONSOLE
          </div>

          <div className="what-if__title-row">
            <span className="label-caps">What-If Simulator</span>

            {dirty && (
              <span className="what-if__scenario-badge">
                MODIFIED
              </span>
            )}
          </div>
        </div>

        <div className={`what-if__status ${loading ? 'what-if__status--active' : ''}`}>
          <span className="what-if__status-dot" />
          {loading ? 'RECOMPUTING' : dirty ? 'SCENARIO READY' : 'BASELINE'}
        </div>
      </div>

      <div className="what-if__divider" />

      <div className="what-if__section-heading">
        <span className="label-caps">Scenario Parameters</span>
        <span className="what-if__live mono">LIVE</span>
      </div>

      <div className="what-if__fields">
        {field(
          'quantity_tonnes_per_month',
          'Quantity',
          ' t/mo',
          { min: 1, max: 200, step: 1 },
          'Material flow volume'
        )}

        {field(
          'moisture_percent',
          'Moisture',
          '%',
          { min: 0, max: 100, step: 0.5 },
          'Incoming material moisture'
        )}

        {field(
          'purity_percent',
          'Purity',
          '%',
          { min: 0, max: 100, step: 0.5 },
          'Recoverable material quality'
        )}
      </div>

      {error && (
        <div className="what-if__error">
          <span className="what-if__error-mark">!</span>
          <div>
            <span className="what-if__error-label">Simulation error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="what-if__result-strip">
        <div>
          <span className="label-caps">Engine Mode</span>
          <strong className="mono">
            {dirty ? 'WHAT-IF' : 'LIVE ANALYSIS'}
          </strong>
        </div>

        <div>
          <span className="label-caps">Memory</span>
          <strong className="mono">READ-ONLY</strong>
        </div>
      </div>

      <div className="what-if__footer">
        <div className="what-if__hint">
          <span className="what-if__hint-dot" />
          {dirty
            ? 'Scenario is simulated and will not modify persistent memory.'
            : 'Values match the actual analysis manifest.'}
        </div>

        <button
          type="button"
          className="what-if__reset"
          disabled={!dirty}
          onClick={() => {
            setDraft(wasteDna)
            setError(null)
            onReset?.()
          }}
        >
          RESET
        </button>
      </div>
    </div>
  )
}