import { useEffect, useMemo, useState } from 'react'
import { simulateWhatIf } from '../services/api.js'
import './WhatIfPanel.css'

function formatNumber(value, digits = 0) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(number)
}

function getValue(source, keys, fallback = null) {
  if (!source) return fallback

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ''
    ) {
      return source[key]
    }
  }

  return fallback
}

function normalizeRoute(route) {
  if (!route) return []

  return String(route)
    .split('→')
    .map((part) => part.trim())
    .filter(Boolean)
}

function getViability(decision) {
  const viable = getValue(decision, [
    'viable',
    'is_viable',
    'isViable',
  ])

  if (viable === true) return 'VIABLE'
  if (viable === false) return 'NOT VIABLE'

  const status = String(
    getValue(decision, [
      'status',
      'decision_status',
      'decisionStatus',
    ]) || ''
  ).toLowerCase()

  if (
    status.includes('viable') ||
    status.includes('accepted') ||
    status.includes('recommended')
  ) {
    return 'VIABLE'
  }

  if (
    status.includes('reject') ||
    status.includes('failed')
  ) {
    return 'NOT VIABLE'
  }

  return '—'
}

function getCost(decision, impact) {
  return (
    getValue(decision, [
      'total_cost',
      'total_cost_inr',
      'totalCost',
      'estimated_cost',
      'estimatedCost',
    ]) ??
    getValue(impact, [
      'total_cost',
      'total_cost_inr',
      'totalCost',
      'estimated_cost',
      'estimatedCost',
    ])
  )
}

function getCo2(decision, impact) {
  return (
    getValue(decision, [
      'co2_saved_kg',
      'co2_savings_kg',
      'co2SavedKg',
      'carbon_saved_kg',
      'carbon_savings_kg',
    ]) ??
    getValue(impact, [
      'co2_saved_kg',
      'co2_savings_kg',
      'co2SavedKg',
      'carbon_saved_kg',
      'carbon_savings_kg',
    ])
  )
}

function getImpactForDecision(
  decision,
  impactPerRoute
) {
  if (!decision || !Array.isArray(impactPerRoute)) {
    return null
  }

  const route = getValue(decision, [
    'recommended_route_id',
    'recommendedRouteId',
    'recommended_route',
    'recommendedRoute',
  ])

  if (!route) return null

  return (
    impactPerRoute.find((item) => {
      const itemRoute = getValue(item, [
        'route_id',
        'routeId',
        'id',
      ])

      return itemRoute === route
    }) || null
  )
}

export default function WhatIfPanel({
  baseWasteDna,
  maxHops = 2,
  onApply,
  onClear,
  isSimulated = false,
}) {
  const [quantity, setQuantity] = useState('')
  const [moisture, setMoisture] = useState('')
  const [purity, setPurity] = useState('')

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!baseWasteDna) {
      setQuantity('')
      setMoisture('')
      setPurity('')
      setResult(null)
      setStatus('idle')
      setError(null)
      return
    }

    setQuantity(
      getValue(baseWasteDna, [
        'quantity_tonnes_per_month',
        'quantityTonnesPerMonth',
        'quantity',
        'tonnes_per_month',
      ], '')
    )

    setMoisture(
      getValue(baseWasteDna, [
        'moisture_percent',
        'moisture',
        'moisture_percentage',
      ], '')
    )

    setPurity(
      getValue(baseWasteDna, [
        'purity_percent',
        'purity',
        'purity_percentage',
      ], '')
    )
  }, [baseWasteDna])

  const sourceFactory = getValue(baseWasteDna, [
    'source_factory',
    'sourceFactory',
    'factory_name',
    'factoryName',
  ])

  const materialName = getValue(baseWasteDna, [
    'material_name',
    'materialName',
    'name',
  ])

  const location = getValue(baseWasteDna, [
    'location',
    'source_location',
    'sourceLocation',
  ])

  const baseline = useMemo(
    () => ({
      quantity: getValue(baseWasteDna, [
        'quantity_tonnes_per_month',
        'quantityTonnesPerMonth',
        'quantity',
        'tonnes_per_month',
      ]),
      moisture: getValue(baseWasteDna, [
        'moisture_percent',
        'moisture',
        'moisture_percentage',
      ]),
      purity: getValue(baseWasteDna, [
        'purity_percent',
        'purity',
        'purity_percentage',
      ]),
    }),
    [baseWasteDna]
  )

  const simulationDecision =
    result?.decision?.data ?? null

  const simulationImpact =
    result?.impact?.data?.per_route ?? []

  const selectedImpact =
    getImpactForDecision(
      simulationDecision,
      simulationImpact
    )

  const simulationRoute = getValue(
    simulationDecision,
    [
      'recommended_route_id',
      'recommendedRouteId',
      'recommended_route',
      'recommendedRoute',
    ]
  )

  const routeParts =
    normalizeRoute(simulationRoute)

  const simulationCost =
    getCost(
      simulationDecision,
      selectedImpact
    )

  const simulationCo2 =
    getCo2(
      simulationDecision,
      selectedImpact
    )

  const simulationViability =
    getViability(simulationDecision)

  const hasChanges =
    String(quantity) !== String(baseline.quantity ?? '') ||
    String(moisture) !== String(baseline.moisture ?? '') ||
    String(purity) !== String(baseline.purity ?? '')

  function handleReset() {
    setQuantity(
      baseline.quantity ?? ''
    )
    setMoisture(
      baseline.moisture ?? ''
    )
    setPurity(
      baseline.purity ?? ''
    )

    setResult(null)
    setStatus('idle')
    setError(null)

    onClear?.()
  }

  async function handleSimulate(event) {
    event.preventDefault()

    if (!baseWasteDna) {
      setError(
        'Run a baseline analysis before starting a simulation.'
      )
      setStatus('error')
      return
    }

    const simulatedWasteDna = {
      ...baseWasteDna,
      quantity_tonnes_per_month:
        Number(quantity),
      moisture_percent:
        Number(moisture),
      purity_percent:
        Number(purity),
    }

    if (
      !Number.isFinite(
        simulatedWasteDna.quantity_tonnes_per_month
      ) ||
      simulatedWasteDna.quantity_tonnes_per_month <= 0
    ) {
      setError(
        'Quantity must be greater than zero.'
      )
      setStatus('error')
      return
    }

    if (
      !Number.isFinite(
        simulatedWasteDna.moisture_percent
      ) ||
      simulatedWasteDna.moisture_percent < 0 ||
      simulatedWasteDna.moisture_percent > 100
    ) {
      setError(
        'Moisture must be between 0% and 100%.'
      )
      setStatus('error')
      return
    }

    if (
      !Number.isFinite(
        simulatedWasteDna.purity_percent
      ) ||
      simulatedWasteDna.purity_percent < 0 ||
      simulatedWasteDna.purity_percent > 100
    ) {
      setError(
        'Purity must be between 0% and 100%.'
      )
      setStatus('error')
      return
    }

    try {
      setStatus('running')
      setError(null)

      const simulation =
        await simulateWhatIf({
          wasteDna: simulatedWasteDna,
          maxHops,
        })

      setResult(simulation)
      setStatus('complete')

      onApply?.(simulation)
    } catch (err) {
      setStatus('error')
      setError(
        err.message ||
          'Simulation failed.'
      )
    }
  }

  if (!baseWasteDna) {
    return (
      <section className="what-if-panel panel what-if-panel--empty">
        <header className="what-if-panel__header">
          <div>
            <span className="label-caps">
              What-If Simulator
            </span>

            <h2 className="what-if-panel__title">
              Scenario analysis
            </h2>
          </div>

          <span className="what-if-panel__status mono">
            STANDBY
          </span>
        </header>

        <div className="what-if-panel__empty">
          <div className="what-if-panel__empty-mark">
            ◇
          </div>

          <span className="label-caps">
            Baseline required
          </span>

          <p>
            Run a live analysis first. The simulator
            then lets you change material conditions
            without writing the scenario to persistent
            memory.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="what-if-panel panel">
      <header className="what-if-panel__header">
        <div>
          <span className="label-caps">
            What-If Simulator
          </span>

          <h2 className="what-if-panel__title">
            Scenario analysis
          </h2>
        </div>

        <span
          className={`what-if-panel__status mono ${
            status === 'running'
              ? 'what-if-panel__status--running'
              : status === 'complete'
                ? 'what-if-panel__status--complete'
                : status === 'error'
                  ? 'what-if-panel__status--error'
                  : ''
          }`}
        >
          {status === 'running'
            ? 'SIMULATING'
            : status === 'complete'
              ? 'RESULT READY'
              : status === 'error'
                ? 'ERROR'
                : isSimulated
                  ? 'SCENARIO ACTIVE'
                  : 'READY'}
        </span>
      </header>

      <div className="what-if-panel__context">
        <div>
          <span className="label-caps">
            Material
          </span>

          <strong>
            {materialName || '—'}
          </strong>
        </div>

        <div>
          <span className="label-caps">
            Source
          </span>

          <strong>
            {sourceFactory || '—'}
          </strong>
        </div>

        <div>
          <span className="label-caps">
            Location
          </span>

          <strong>
            {location || '—'}
          </strong>
        </div>

        <div>
          <span className="label-caps">
            Search Depth
          </span>

          <strong className="mono">
            {String(maxHops).padStart(2, '0')} HOPS
          </strong>
        </div>
      </div>

      <form
        className="what-if-panel__form"
        onSubmit={handleSimulate}
      >
        <div className="what-if-panel__section-heading">
          <div>
            <span className="label-caps">
              Scenario Inputs
            </span>

            <p>
              Adjust one or more material properties.
            </p>
          </div>

          {hasChanges && (
            <span className="what-if-panel__modified mono">
              MODIFIED
            </span>
          )}
        </div>

        <div className="what-if-panel__inputs">
          <label className="what-if-panel__input">
            <span className="label-caps">
              Quantity
            </span>

            <div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
              />

              <span className="mono">
                T/M
              </span>
            </div>

            <small>
              Baseline:{' '}
              {baseline.quantity ?? '—'} T/M
            </small>
          </label>

          <label className="what-if-panel__input">
            <span className="label-caps">
              Moisture
            </span>

            <div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={moisture}
                onChange={(event) =>
                  setMoisture(event.target.value)
                }
              />

              <span className="mono">
                %
              </span>
            </div>

            <small>
              Baseline:{' '}
              {baseline.moisture ?? '—'}%
            </small>
          </label>

          <label className="what-if-panel__input">
            <span className="label-caps">
              Purity
            </span>

            <div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={purity}
                onChange={(event) =>
                  setPurity(event.target.value)
                }
              />

              <span className="mono">
                %
              </span>
            </div>

            <small>
              Baseline:{' '}
              {baseline.purity ?? '—'}%
            </small>
          </label>
        </div>

        {error && (
          <div className="what-if-panel__error">
            <span className="mono">
              SIMULATION ERROR
            </span>

            <span>{error}</span>
          </div>
        )}

        <div className="what-if-panel__actions">
          <button
            type="submit"
            className="what-if-panel__simulate"
            disabled={
              status === 'running'
            }
          >
            <span className="mono">
              {status === 'running'
                ? 'RUNNING...'
                : 'RUN SCENARIO'}
            </span>

            {status !== 'running' && (
              <span>→</span>
            )}
          </button>

          <button
            type="button"
            className="what-if-panel__reset"
            onClick={handleReset}
          >
            RESET
          </button>
        </div>
      </form>

      {status === 'complete' &&
        simulationDecision && (
          <section className="what-if-panel__results">
            <div className="what-if-panel__results-header">
              <div>
                <span className="label-caps">
                  Simulation Output
                </span>

                <strong>
                  Scenario decision
                </strong>
              </div>

              <span className="what-if-panel__simulation-badge mono">
                SIMULATION ONLY
              </span>
            </div>

            <div className="what-if-panel__metrics">
              <div>
                <span className="label-caps">
                  Viability
                </span>

                <strong
                  className={
                    simulationViability ===
                    'VIABLE'
                      ? 'is-positive'
                      : simulationViability ===
                          'NOT VIABLE'
                        ? 'is-negative'
                        : ''
                  }
                >
                  {simulationViability}
                </strong>
              </div>

              <div>
                <span className="label-caps">
                  Hops
                </span>

                <strong className="mono">
                  {routeParts.length > 1
                    ? String(
                        routeParts.length - 1
                      ).padStart(2, '0')
                    : '—'}
                </strong>
              </div>

              <div>
                <span className="label-caps">
                  Cost
                </span>

                <strong className="mono">
                  {simulationCost !== null
                    ? `₹${formatNumber(
                        simulationCost,
                        2
                      )}`
                    : '—'}
                </strong>
              </div>

              <div>
                <span className="label-caps">
                  CO₂ Saved
                </span>

                <strong className="mono">
                  {simulationCo2 !== null
                    ? `${formatNumber(
                        simulationCo2,
                        2
                      )} kg`
                    : '—'}
                </strong>
              </div>
            </div>

            <div className="what-if-panel__route">
              <span className="label-caps">
                Scenario Route
              </span>

              {routeParts.length > 0 ? (
                <div className="what-if-panel__route-chain">
                  {routeParts.map(
                    (part, index) => (
                      <div
                        key={`${part}-${index}`}
                        className="what-if-panel__route-step"
                      >
                        <span className="mono">
                          {String(
                            index + 1
                          ).padStart(2, '0')}
                        </span>

                        <strong>
                          {part}
                        </strong>

                        {index <
                          routeParts.length -
                            1 && (
                          <span className="what-if-panel__route-arrow">
                            →
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="what-if-panel__no-route">
                  No scenario route returned.
                </div>
              )}
            </div>

            <div className="what-if-panel__notice">
              <span className="what-if-panel__notice-dot" />

              <span>
                Scenario evaluated independently.
                Persistent memory is not modified.
              </span>
            </div>
          </section>
        )}

      {status === 'idle' && (
        <div className="what-if-panel__instruction">
          <span className="mono">
            A01
          </span>

          <span>
            Modify the material profile, then run
            the scenario to compare the resulting
            industrial pathway.
          </span>
        </div>
      )}
    </section>
  )
}