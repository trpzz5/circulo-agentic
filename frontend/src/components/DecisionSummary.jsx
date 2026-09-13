import './DecisionSummary.css'

function getValue(source, keys) {
  if (!source || typeof source !== 'object') {
    return null
  }

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ''
    ) {
      return source[key]
    }
  }

  return null
}

function formatNumber(value, digits = 0) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number)
}

function formatCurrency(value, digits = 2) {
  if (value === null || value === undefined) {
    return '—'
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return `₹${formatNumber(number, digits)}`
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return '—'
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  const percentage =
    Math.abs(number) <= 1 ? number * 100 : number

  return `${formatNumber(percentage, 0)}%`
}

function normalizeRoute(route) {
  if (!route) {
    return []
  }

  if (Array.isArray(route)) {
    return route
      .flatMap((item) => {
        if (typeof item === 'string') {
          return [item]
        }

        if (item && typeof item === 'object') {
          const name = getValue(item, [
            'factory_name',
            'factoryName',
            'name',
            'label',
            'route',
          ])

          return name ? [name] : []
        }

        return []
      })
      .map((part) => String(part).trim())
      .filter(Boolean)
  }

  if (typeof route === 'object') {
    const explicitParts = getValue(route, [
      'nodes',
      'factories',
      'path',
      'route_parts',
      'routeParts',
    ])

    if (Array.isArray(explicitParts)) {
      return normalizeRoute(explicitParts)
    }

    const source = getValue(route, [
      'source_factory',
      'sourceFactory',
      'source',
      'origin',
      'from',
    ])

    const processor = getValue(route, [
      'processor',
      'processor_factory',
      'processorFactory',
      'intermediate_factory',
      'intermediateFactory',
    ])

    const destination = getValue(route, [
      'destination_factory',
      'destinationFactory',
      'destination',
      'target',
      'to',
    ])

    return [source, processor, destination]
      .filter(Boolean)
      .map((part) => String(part).trim())
  }

  return String(route)
    .split('→')
    .map((part) => part.trim())
    .filter(Boolean)
}

function getRecommendedRoute(decision) {
  if (!decision) {
    return null
  }

  const directRoute = getValue(decision, [
    'recommended_route',
    'recommendedRoute',
    'recommended_route_id',
    'recommendedRouteId',
    'selected_route',
    'selectedRoute',
    'best_route',
    'bestRoute',
    'route',
  ])

  const directParts = normalizeRoute(directRoute)

  if (directParts.length > 0) {
    return directParts
  }

  const source = getValue(decision, [
    'source_factory',
    'sourceFactory',
    'source',
    'origin_factory',
    'originFactory',
  ])

  const processor = getValue(decision, [
    'processor_factory',
    'processorFactory',
    'processor',
    'intermediate_factory',
    'intermediateFactory',
  ])

  const destination = getValue(decision, [
    'destination_factory',
    'destinationFactory',
    'destination',
    'target_factory',
    'targetFactory',
  ])

  return [source, processor, destination]
    .filter(Boolean)
    .map((part) => String(part).trim())
}

function getDecisionStatus(decision) {
  if (!decision) {
    return {
      label: 'AWAITING DECISION',
      className: 'standby',
    }
  }

  const viable = getValue(decision, [
    'viable',
    'is_viable',
    'isViable',
  ])

  if (viable === false) {
    return {
      label: 'NO VIABLE ROUTE',
      className: 'failed',
    }
  }

  return {
    label: 'DECISION READY',
    className: 'ready',
  }
}

function getViability(decision) {
  const viable = getValue(decision, [
    'viable',
    'is_viable',
    'isViable',
  ])

  if (viable === true) {
    return 'VIABLE'
  }

  if (viable === false) {
    return 'NOT VIABLE'
  }

  const status = String(
    getValue(decision, [
      'status',
      'decision_status',
      'decisionStatus',
      'outcome',
    ]) || ''
  ).toLowerCase()

  if (
    status.includes('viable') ||
    status.includes('accepted') ||
    status.includes('recommended') ||
    status.includes('selected') ||
    status.includes('complete')
  ) {
    return 'VIABLE'
  }

  if (
    status.includes('reject') ||
    status.includes('failed') ||
    status.includes('not viable')
  ) {
    return 'NOT VIABLE'
  }

  return 'VIABLE'
}

function getReasonList(decision) {
  const reasons = getValue(decision, [
    'reasons',
    'reasoning',
    'decision_reasons',
    'decisionReasons',
  ])

  if (Array.isArray(reasons)) {
    return reasons.filter(Boolean)
  }

  if (typeof reasons === 'string' && reasons.trim()) {
    return [reasons]
  }

  const reason = getValue(decision, [
    'reason',
    'rationale',
    'explanation',
    'decision_reason',
    'decisionReason',
  ])

  return reason ? [reason] : []
}

function getAlternatives(decision) {
  const alternatives = getValue(decision, [
    'alternatives',
    'alternative_routes',
    'alternativeRoutes',
    'other_routes',
    'otherRoutes',
  ])

  return Array.isArray(alternatives)
    ? alternatives
    : []
}

function getAlternativeRoute(item) {
  if (typeof item === 'string') {
    return item
  }

  if (!item) {
    return null
  }

  const route = getValue(item, [
    'route',
    'route_id',
    'routeId',
    'id',
    'name',
    'label',
  ])

  const parts = normalizeRoute(route)

  if (parts.length > 0) {
    return parts.join(' → ')
  }

  const source = getValue(item, [
    'source_factory',
    'sourceFactory',
    'source',
  ])

  const processor = getValue(item, [
    'processor_factory',
    'processorFactory',
    'processor',
  ])

  const destination = getValue(item, [
    'destination_factory',
    'destinationFactory',
    'destination',
  ])

  return [source, processor, destination]
    .filter(Boolean)
    .join(' → ')
}

function getAlternativeScore(item) {
  if (!item || typeof item === 'string') {
    return null
  }

  return getValue(item, [
    'score',
    'total_score',
    'totalScore',
    'ranking_score',
    'rankingScore',
    'confidence',
    'confidence_score',
  ])
}

function getImpact(decision) {
  return (
    getValue(decision, [
      'impact',
      'impact_summary',
      'environmental_impact',
      'environmentalImpact',
    ]) || {}
  )
}

function getEconomics(decision) {
  return (
    getValue(decision, [
      'economics',
      'economic_summary',
      'financials',
      'costs',
    ]) || {}
  )
}

function getMetric(decision, nested, keys) {
  const nestedValue = getValue(nested, keys)

  if (nestedValue !== null) {
    return nestedValue
  }

  return getValue(decision, keys)
}

function Metric({
  label,
  value,
  unit,
  primary = false,
}) {
  return (
    <div
      className={`decision-summary__metric${
        primary
          ? ' decision-summary__metric--primary'
          : ''
      }`}
    >
      <span className="label-caps">
        {label}
      </span>

      <strong className="mono">
        {value}

        {unit && (
          <span className="decision-summary__metric-unit">
            {unit}
          </span>
        )}
      </strong>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  count,
}) {
  return (
    <div className="decision-summary__section-heading">
      <span className="label-caps">
        {eyebrow}
      </span>

      {count !== undefined && (
        <span className="mono decision-summary__section-count">
          {String(count).padStart(2, '0')}
        </span>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <section className="decision-summary panel decision-summary--empty">
      <header className="decision-summary__header">
        <div>
          <span className="label-caps">
            Decision Intelligence
          </span>

          <h2 className="decision-summary__title">
            Awaiting route decision
          </h2>

          <p className="decision-summary__subtitle">
            Decision Agent synthesis across feasibility,
            impact and economics.
          </p>
        </div>

        <span className="decision-summary__status decision-summary__status--standby mono">
          <span className="decision-summary__status-dot" />
          STANDBY
        </span>
      </header>

      <div className="decision-summary__empty">
        <div className="decision-summary__empty-mark">
          <span>◇</span>
        </div>

        <span className="label-caps">
          Decision Agent
        </span>

        <p>
          Run the analysis pipeline to evaluate candidate
          routes and produce the recommended industrial
          pathway.
        </p>
      </div>
    </section>
  )
}

export default function DecisionSummary({
  decision,
}) {
  if (!decision) {
    return <EmptyState />
  }

  const status = getDecisionStatus(decision)
  const viability = getViability(decision)

  const routeParts =
    getRecommendedRoute(decision)

  const hops =
    getValue(decision, [
      'hops',
      'hop_count',
      'hopCount',
      'max_hops',
      'maxHops',
    ]) ??
    (routeParts.length > 1
      ? routeParts.length - 1
      : null)

  const confidence = getValue(decision, [
    'confidence',
    'confidence_score',
    'confidenceScore',
    'decision_confidence',
    'decisionConfidence',
  ])

  const impact = getImpact(decision)
  const economics = getEconomics(decision)

  const totalCost = getMetric(
    decision,
    economics,
    [
      'total_cost',
      'total_cost_inr',
      'totalCost',
      'estimated_cost',
      'estimatedCost',
      'route_cost',
      'route_cost_inr',
    ]
  )

  const processingCost = getMetric(
    decision,
    economics,
    [
      'processing_cost',
      'processing_cost_inr',
      'processingCost',
      'processingCostPerTonne',
      'processing_cost_per_tonne',
    ]
  )

  const transportCost = getMetric(
    decision,
    economics,
    [
      'transportation_cost',
      'transportation_cost_inr',
      'transportCost',
      'transportationCost',
      'transport_cost',
      'transport_cost_inr',
    ]
  )

  const distance = getMetric(
    decision,
    decision,
    [
      'total_distance_km',
      'totalDistanceKm',
      'distance_km',
      'distanceKm',
      'route_distance_km',
    ]
  )

  const monthlyFlow = getMetric(
    decision,
    decision,
    [
      'quantity_tonnes_per_month',
      'quantity_tonnes',
      'quantity',
      'monthly_quantity',
      'monthlyQuantity',
      'flow_tonnes_per_month',
    ]
  )

  const co2Saved = getMetric(
    decision,
    impact,
    [
      'co2_saved_kg',
      'co2_savings_kg',
      'co2SavedKg',
      'carbon_saved_kg',
      'carbon_savings_kg',
      'co2_avoided_kg',
      'co2_avoided',
    ]
  )

  const wasteDiverted = getMetric(
    decision,
    impact,
    [
      'waste_diverted_tonnes',
      'landfill_avoided_tonnes',
      'diverted_tonnes',
      'waste_diverted',
    ]
  )

  const waterSaved = getMetric(
    decision,
    impact,
    [
      'water_saved_litres',
      'water_saved_liters',
      'water_saved',
    ]
  )

  const energySaved = getMetric(
    decision,
    impact,
    [
      'energy_saved_kwh',
      'energy_saved',
    ]
  )

  const environmentalImpact = getMetric(
    decision,
    impact,
    [
      'environmental_impact',
      'environmentalImpact',
      'impact_score',
      'impactScore',
      'ecosystem_value',
      'ecosystemValue',
    ]
  )

  const reasons = getReasonList(decision)
  const alternatives = getAlternatives(decision)

  return (
    <section className="decision-summary panel">
      <header className="decision-summary__header">
        <div>
          <span className="label-caps">
            Decision Intelligence
          </span>

          <h2 className="decision-summary__title">
            Recommended Route
          </h2>

          <p className="decision-summary__subtitle">
            Decision Agent synthesis across feasibility,
            impact and economics.
          </p>
        </div>

        <span
          className={`decision-summary__status decision-summary__status--${status.className} mono`}
        >
          <span className="decision-summary__status-dot" />
          {status.label}
        </span>
      </header>

      <div className="decision-summary__hero">
        <div className="decision-summary__hero-label">
          <span className="label-caps">
            Selected Symbiosis Path
          </span>

          <span className="decision-summary__agent mono">
            DECISION AGENT
          </span>
        </div>

        {routeParts.length > 0 ? (
          <div className="decision-summary__route">
            {routeParts.map((part, index) => (
              <div
                className="decision-summary__route-item"
                key={`${part}-${index}`}
              >
                <span className="decision-summary__route-index mono">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div className="decision-summary__route-content">
                  <span className="decision-summary__route-role label-caps">
                    {index === 0
                      ? 'SOURCE'
                      : index === routeParts.length - 1
                        ? 'DESTINATION'
                        : 'PROCESSOR'}
                  </span>

                  <strong>
                    {part}
                  </strong>
                </div>

                {index < routeParts.length - 1 && (
                  <span className="decision-summary__route-arrow">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="decision-summary__no-route">
            No recommended route returned.
          </div>
        )}
      </div>

      <div className="decision-summary__key-metrics">
        <Metric
          label="Viability"
          value={viability}
          primary
        />

        <Metric
          label="Confidence"
          value={formatPercent(confidence)}
        />

        <Metric
          label="Hops"
          value={
            hops !== null
              ? String(hops).padStart(2, '0')
              : '—'
          }
        />

        <Metric
          label="Distance"
          value={formatNumber(distance, 1)}
          unit=" km"
        />

        <Metric
          label="Monthly Flow"
          value={formatNumber(monthlyFlow, 1)}
          unit=" t"
        />

        <Metric
          label="Total Cost"
          value={formatCurrency(totalCost)}
          unit={totalCost !== null ? ' /t' : null}
        />
      </div>

      {(processingCost !== null ||
        transportCost !== null ||
        co2Saved !== null ||
        environmentalImpact !== null) && (
        <section className="decision-summary__section">
          <SectionHeading eyebrow="DECISION METRICS" />

          <div className="decision-summary__metrics-grid">
            {processingCost !== null && (
              <div>
                <span className="label-caps">
                  Processing
                </span>

                <strong className="mono">
                  {formatCurrency(processingCost)}
                  <small>/t</small>
                </strong>
              </div>
            )}

            {transportCost !== null && (
              <div>
                <span className="label-caps">
                  Transport
                </span>

                <strong className="mono">
                  {formatCurrency(transportCost)}
                  <small>/t</small>
                </strong>
              </div>
            )}

            {co2Saved !== null && (
              <div>
                <span className="label-caps">
                  CO₂ Avoided
                </span>

                <strong className="mono">
                  {formatNumber(co2Saved, 1)}
                  <small> kg</small>
                </strong>
              </div>
            )}

            {environmentalImpact !== null && (
              <div>
                <span className="label-caps">
                  Ecosystem Value
                </span>

                <strong className="mono">
                  {formatNumber(
                    environmentalImpact,
                    2
                  )}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {(co2Saved !== null ||
        wasteDiverted !== null ||
        waterSaved !== null ||
        energySaved !== null) && (
        <section className="decision-summary__section">
          <SectionHeading eyebrow="ENVIRONMENTAL IMPACT" />

          <div className="decision-summary__metrics-grid decision-summary__metrics-grid--impact">
            {co2Saved !== null && (
              <div>
                <span className="label-caps">
                  CO₂ Avoided
                </span>

                <strong className="mono">
                  {formatNumber(co2Saved, 1)}
                  <small> kg</small>
                </strong>
              </div>
            )}

            {wasteDiverted !== null && (
              <div>
                <span className="label-caps">
                  Waste Diverted
                </span>

                <strong className="mono">
                  {formatNumber(
                    wasteDiverted,
                    1
                  )}
                  <small> t</small>
                </strong>
              </div>
            )}

            {waterSaved !== null && (
              <div>
                <span className="label-caps">
                  Water Saved
                </span>

                <strong className="mono">
                  {formatNumber(
                    waterSaved,
                    0
                  )}
                  <small> L</small>
                </strong>
              </div>
            )}

            {energySaved !== null && (
              <div>
                <span className="label-caps">
                  Energy Saved
                </span>

                <strong className="mono">
                  {formatNumber(
                    energySaved,
                    1
                  )}
                  <small> kWh</small>
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {(processingCost !== null ||
        transportCost !== null ||
        totalCost !== null) && (
        <section className="decision-summary__section">
          <SectionHeading eyebrow="ROUTE ECONOMICS" />

          <div className="decision-summary__economics">
            {transportCost !== null && (
              <div className="decision-summary__economic-row">
                <span>Transport</span>

                <strong className="mono">
                  {formatCurrency(transportCost)}
                  <small>/t</small>
                </strong>
              </div>
            )}

            {processingCost !== null && (
              <div className="decision-summary__economic-row">
                <span>Processing</span>

                <strong className="mono">
                  {formatCurrency(processingCost)}
                  <small>/t</small>
                </strong>
              </div>
            )}

            {totalCost !== null && (
              <div className="decision-summary__economic-row decision-summary__economic-row--total">
                <span>Total Route Cost</span>

                <strong className="mono">
                  {formatCurrency(totalCost)}
                  <small>/t</small>
                </strong>
              </div>
            )}
          </div>
        </section>
      )}

      {reasons.length > 0 && (
        <section className="decision-summary__section">
          <SectionHeading
            eyebrow="DECISION RATIONALE"
            count={reasons.length}
          />

          <div className="decision-summary__reasons">
            {reasons.map((reason, index) => (
              <div
                className="decision-summary__reason"
                key={`${reason}-${index}`}
              >
                <span className="decision-summary__reason-index mono">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span>
                  {reason}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="decision-summary__section">
          <SectionHeading
            eyebrow="ALTERNATIVE ROUTES"
            count={alternatives.length}
          />

          <div className="decision-summary__alternatives">
            {alternatives.map(
              (alternative, index) => {
                const route =
                  getAlternativeRoute(
                    alternative
                  )

                const score =
                  getAlternativeScore(
                    alternative
                  )

                return (
                  <div
                    className="decision-summary__alternative"
                    key={`${route || index}`}
                  >
                    <span className="decision-summary__alternative-index mono">
                      {String(index + 1).padStart(
                        2,
                        '0'
                      )}
                    </span>

                    <span
                      className="decision-summary__alternative-route mono"
                      title={route || ''}
                    >
                      {route ||
                        'Unnamed route'}
                    </span>

                    {score !== null && (
                      <span className="decision-summary__alternative-score mono">
                        {formatPercent(
                          score
                        )}
                      </span>
                    )}
                  </div>
                )
              }
            )}
          </div>
        </section>
      )}

      <footer className="decision-summary__footer">
        <span className="decision-summary__footer-dot" />

        <span className="mono">
          {routeParts.length > 0
            ? 'DECISION OUTPUT VERIFIED'
            : 'DECISION OUTPUT RECEIVED'}
        </span>
      </footer>
    </section>
  )
}