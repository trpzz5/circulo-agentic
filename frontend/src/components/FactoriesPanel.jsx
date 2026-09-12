import { useEffect, useMemo, useState } from 'react'
import { getFactories, getFactory } from '../services/api.js'
import './FactoriesPanel.css'

function formatNumber(value, digits = 0) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '—'

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(number)
}

function formatRate(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '—'

  return `₹${formatNumber(number, 2)}/km`
}

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function uniqueValues(items, key) {
  return [...new Set(
    items
      .map((item) => item?.[key])
      .filter(Boolean)
  )]
}

export default function FactoriesPanel() {
  const [factories, setFactories] = useState([])
  const [selectedFactory, setSelectedFactory] = useState(null)

  const [query, setQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')

  const [registryStatus, setRegistryStatus] = useState('loading')
  const [detailStatus, setDetailStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [detailError, setDetailError] = useState(null)

  useEffect(() => {
    let active = true

    async function loadFactories() {
      try {
        setRegistryStatus('loading')
        setError(null)

        const data = await getFactories()

        if (!active) return

        setFactories(Array.isArray(data) ? data : [])
        setRegistryStatus('ready')
      } catch (err) {
        if (!active) return

        setError(err.message || 'Failed to load factory registry.')
        setRegistryStatus('error')
      }
    }

    loadFactories()

    return () => {
      active = false
    }
  }, [])

  const industries = useMemo(
    () => uniqueValues(factories, 'industry').sort(),
    [factories]
  )

  const locations = useMemo(
    () => uniqueValues(factories, 'location').sort(),
    [factories]
  )

  const totalCapacity = useMemo(
    () =>
      factories.reduce(
        (sum, factory) => sum + (Number(factory.capacity_tonnes_per_month) || 0),
        0
      ),
    [factories]
  )

  const filteredFactories = useMemo(() => {
    const normalizedQuery = normalize(query)

    return factories.filter((factory) => {
      if (
        industryFilter !== 'all' &&
        normalize(factory.industry) !== normalize(industryFilter)
      ) {
        return false
      }

      if (!normalizedQuery) return true

      return [
        factory.factory_name,
        factory.factory_id,
        factory.industry,
        factory.location,
        factory.notes,
      ]
        .filter(Boolean)
        .some((value) => normalize(value).includes(normalizedQuery))
    })
  }, [factories, query, industryFilter])

  async function openFactory(factory) {
    setSelectedFactory(factory)
    setDetailStatus('loading')
    setDetailError(null)

    try {
      const detail = await getFactory(factory.factory_id)
      setSelectedFactory(detail)
      setDetailStatus('ready')
    } catch (err) {
      setDetailError(err.message || 'Failed to load factory intelligence.')
      setDetailStatus('error')
    }
  }

  function closeDetail() {
    setSelectedFactory(null)
    setDetailStatus('idle')
    setDetailError(null)
  }

  return (
    <section className="factories-panel panel">
      <header className="factories-panel__header">
        <div>
          <div className="factories-panel__eyebrow">
            <span className="label-caps">Industrial Registry</span>
            <span className="factories-panel__live mono">
              {registryStatus === 'ready'
                ? 'LIVE DATA'
                : registryStatus === 'error'
                  ? 'ERROR'
                  : 'SYNC'}
            </span>
          </div>

          <h2 className="factories-panel__title">
            Factory intelligence
          </h2>

          <p className="factories-panel__subtitle">
            Industrial nodes, material compatibility, capacity and processing capabilities.
          </p>
        </div>

        <div className="factories-panel__registry-state">
          <span
            className={`factories-panel__registry-dot factories-panel__registry-dot--${registryStatus}`}
          />

          <div>
            <span className="label-caps">Registry</span>
            <strong className="mono">
              {registryStatus === 'ready'
                ? 'CONNECTED'
                : registryStatus === 'error'
                  ? 'UNAVAILABLE'
                  : 'SYNCING'}
            </strong>
          </div>
        </div>
      </header>

      <div className="factories-panel__stats">
        <div className="factories-panel__stat factories-panel__stat--primary">
          <span className="factories-panel__stat-value mono">
            {factories.length}
          </span>
          <span className="label-caps">Industrial Nodes</span>
        </div>

        <div className="factories-panel__stat">
          <span className="factories-panel__stat-value mono">
            {formatNumber(totalCapacity)}
          </span>
          <span className="label-caps">Tonnes / Month</span>
        </div>

        <div className="factories-panel__stat">
          <span className="factories-panel__stat-value mono">
            {industries.length}
          </span>
          <span className="label-caps">Industries</span>
        </div>

        <div className="factories-panel__stat">
          <span className="factories-panel__stat-value mono">
            {locations.length}
          </span>
          <span className="label-caps">Locations</span>
        </div>
      </div>

      <div className="factories-panel__toolbar">
        <div className="factories-panel__search">
          <span className="factories-panel__search-icon mono">
            /
          </span>

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search industrial nodes..."
            aria-label="Search factories"
          />

          {query && (
            <button
              type="button"
              className="factories-panel__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="factories-panel__filters">
          <button
            type="button"
            className={`factories-panel__filter ${
              industryFilter === 'all'
                ? 'factories-panel__filter--active'
                : ''
            }`}
            onClick={() => setIndustryFilter('all')}
          >
            ALL
          </button>

          {industries.map((industry) => (
            <button
              key={industry}
              type="button"
              className={`factories-panel__filter ${
                industryFilter === industry
                  ? 'factories-panel__filter--active'
                  : ''
              }`}
              onClick={() => setIndustryFilter(industry)}
            >
              {industry}
            </button>
          ))}
        </div>

        <span className="factories-panel__source mono">
          FACTORY REGISTRY / READ
        </span>
      </div>

      {registryStatus === 'loading' && (
        <div className="factories-panel__state">
          <span className="factories-panel__state-dot" />
          <span>Synchronizing industrial registry...</span>
        </div>
      )}

      {registryStatus === 'error' && (
        <div className="factories-panel__state factories-panel__state--error">
          <span className="mono">REGISTRY ERROR</span>
          <span>{error}</span>
        </div>
      )}

      {registryStatus === 'ready' && filteredFactories.length === 0 && (
        <div className="factories-panel__empty">
          <div className="factories-panel__empty-mark">
            ∅
          </div>

          <span className="label-caps">
            No matching industrial nodes
          </span>

          <p>
            No factories match the current search and industry filter.
          </p>

          {(query || industryFilter !== 'all') && (
            <button
              type="button"
              className="factories-panel__empty-reset"
              onClick={() => {
                setQuery('')
                setIndustryFilter('all')
              }}
            >
              RESET FILTERS
            </button>
          )}
        </div>
      )}

      {registryStatus === 'ready' && filteredFactories.length > 0 && (
        <div className="factories-panel__registry">
          <div className="factories-panel__registry-heading">
            <div>
              <span className="label-caps">
                Industrial Network
              </span>

              <strong>
                Registered factory nodes
              </strong>
            </div>

            <span className="mono">
              {filteredFactories.length
                .toString()
                .padStart(2, '0')}{' '}
              MATCHED
            </span>
          </div>

          <div className="factories-panel__grid">
            {filteredFactories.map((factory) => (
              <article
                key={factory.factory_id}
                className="factory-card"
              >
                <div className="factory-card__top">
                  <div className="factory-card__node">
                    <span className="factory-card__node-core" />
                    <span className="mono">
                      NODE
                    </span>
                  </div>

                  <span className="factory-card__id mono">
                    {factory.factory_id || '—'}
                  </span>
                </div>

                <div className="factory-card__identity">
                  <h3>
                    {factory.factory_name || 'Unnamed Factory'}
                  </h3>

                  <span className="factory-card__industry">
                    {factory.industry || 'Industrial facility'}
                  </span>
                </div>

                <div className="factory-card__location">
                  <span className="label-caps">
                    Location
                  </span>
                  <strong>
                    {factory.location || '—'}
                  </strong>
                </div>

                <div className="factory-card__metrics">
                  <div>
                    <span className="label-caps">
                      Capacity
                    </span>
                    <strong className="mono">
                      {formatNumber(
                        factory.capacity_tonnes_per_month
                      )}
                      <small> T/M</small>
                    </strong>
                  </div>

                  <div>
                    <span className="label-caps">
                      Transport
                    </span>
                    <strong className="mono">
                      {formatRate(
                        factory.transportation_rate_per_km
                      )}
                    </strong>
                  </div>
                </div>

                {factory.notes && (
                  <p className="factory-card__notes">
                    {factory.notes}
                  </p>
                )}

                <button
                  type="button"
                  className="factory-card__inspect"
                  onClick={() => openFactory(factory)}
                >
                  <span>INSPECT NODE</span>
                  <span className="mono">→</span>
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      <footer className="factories-panel__footer">
        <div className="factories-panel__footer-status">
          <span className="factories-panel__footer-dot" />
          <span className="mono">
            {registryStatus === 'ready'
              ? 'INDUSTRIAL REGISTRY AVAILABLE'
              : registryStatus === 'error'
                ? 'REGISTRY UNAVAILABLE'
                : 'SYNCHRONIZING REGISTRY'}
          </span>
        </div>

        <span className="factories-panel__footer-note label-caps">
          Factory capabilities are sourced from the live registry
        </span>
      </footer>

      {selectedFactory && (
        <div
          className="factory-detail-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetail()
            }
          }}
        >
          <aside
            className="factory-detail"
            role="dialog"
            aria-modal="true"
            aria-label="Factory intelligence"
          >
            <header className="factory-detail__header">
              <div>
                <span className="label-caps">
                  Industrial Node
                </span>

                <h2>
                  {selectedFactory.factory_name || 'Factory'}
                </h2>

                <span className="factory-detail__id mono">
                  {selectedFactory.factory_id || '—'}
                </span>
              </div>

              <button
                type="button"
                className="factory-detail__close"
                onClick={closeDetail}
                aria-label="Close factory details"
              >
                ×
              </button>
            </header>

            {detailStatus === 'loading' && (
              <div className="factory-detail__loading">
                <span className="factories-panel__state-dot" />
                <span>
                  Loading node intelligence...
                </span>
              </div>
            )}

            {detailStatus === 'error' && (
              <div className="factory-detail__error">
                <span className="mono">NODE QUERY ERROR</span>
                <span>{detailError}</span>
              </div>
            )}

            {detailStatus === 'ready' && (
              <div className="factory-detail__body">
                <section className="factory-detail__overview">
                  <div className="factory-detail__overview-main">
                    <span className="label-caps">
                      Industry
                    </span>
                    <strong>
                      {selectedFactory.industry || '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="label-caps">
                      Location
                    </span>
                    <strong>
                      {selectedFactory.location || '—'}
                    </strong>
                  </div>

                  <div>
                    <span className="label-caps">
                      Capacity
                    </span>
                    <strong className="mono">
                      {formatNumber(
                        selectedFactory.capacity_tonnes_per_month
                      )}{' '}
                      T/M
                    </strong>
                  </div>

                  <div>
                    <span className="label-caps">
                      Transport
                    </span>
                    <strong className="mono">
                      {formatRate(
                        selectedFactory.transportation_rate_per_km
                      )}
                    </strong>
                  </div>
                </section>

                {selectedFactory.notes && (
                  <section className="factory-detail__section">
                    <div className="factory-detail__section-heading">
                      <span className="label-caps">
                        Node Notes
                      </span>
                    </div>

                    <p className="factory-detail__notes">
                      {selectedFactory.notes}
                    </p>
                  </section>
                )}

                <section className="factory-detail__section">
                  <div className="factory-detail__section-heading">
                    <div>
                      <span className="label-caps">
                        Material Interface
                      </span>
                      <strong>
                        Accepted materials
                      </strong>
                    </div>

                    <span className="mono">
                      {Array.isArray(selectedFactory.accepted)
                        ? selectedFactory.accepted.length
                        : 0}{' '}
                      RULES
                    </span>
                  </div>

                  {Array.isArray(selectedFactory.accepted) &&
                  selectedFactory.accepted.length > 0 ? (
                    <div className="factory-detail__rules">
                      {selectedFactory.accepted.map((material) => (
                        <div
                          key={material.material_id}
                          className="factory-detail__rule factory-detail__rule--accepted"
                        >
                          <div>
                            <span className="factory-detail__rule-dot" />
                            <strong>
                              {material.material_name || '—'}
                            </strong>
                            <span className="mono">
                              {material.material_id || ''}
                            </span>
                          </div>

                          <div className="factory-detail__rule-values">
                            {material.moisture_limit_percent != null && (
                              <span className="mono">
                                MOIST ≤{' '}
                                {formatNumber(
                                  material.moisture_limit_percent,
                                  1
                                )}
                                %
                              </span>
                            )}

                            {material.purity_requirement_percent != null && (
                              <span className="mono">
                                PURITY ≥{' '}
                                {formatNumber(
                                  material.purity_requirement_percent,
                                  1
                                )}
                                %
                              </span>
                            )}

                            <span className="mono">
                              BUY ₹
                              {formatNumber(
                                material.purchase_price_per_tonne,
                                2
                              )}
                              /T
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="factory-detail__empty-line">
                      No accepted-material rules recorded.
                    </div>
                  )}
                </section>

                <section className="factory-detail__section">
                  <div className="factory-detail__section-heading">
                    <div>
                      <span className="label-caps">
                        Material Interface
                      </span>
                      <strong>
                        Rejected materials
                      </strong>
                    </div>

                    <span className="mono">
                      {Array.isArray(selectedFactory.rejected)
                        ? selectedFactory.rejected.length
                        : 0}{' '}
                      RULES
                    </span>
                  </div>

                  {Array.isArray(selectedFactory.rejected) &&
                  selectedFactory.rejected.length > 0 ? (
                    <div className="factory-detail__rules">
                      {selectedFactory.rejected.map((material) => (
                        <div
                          key={material.material_id}
                          className="factory-detail__rule factory-detail__rule--rejected"
                        >
                          <div>
                            <span className="factory-detail__rule-dot" />
                            <strong>
                              {material.material_name || '—'}
                            </strong>
                            <span className="mono">
                              {material.material_id || ''}
                            </span>
                          </div>

                          <p>
                            {material.reason || 'No rejection reason recorded.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="factory-detail__empty-line">
                      No rejected-material rules recorded.
                    </div>
                  )}
                </section>

                <section className="factory-detail__section">
                  <div className="factory-detail__section-heading">
                    <div>
                      <span className="label-caps">
                        Transformation
                      </span>
                      <strong>
                        Processing capabilities
                      </strong>
                    </div>

                    <span className="mono">
                      {Array.isArray(selectedFactory.processing)
                        ? selectedFactory.processing.length
                        : 0}{' '}
                      ROUTES
                    </span>
                  </div>

                  {Array.isArray(selectedFactory.processing) &&
                  selectedFactory.processing.length > 0 ? (
                    <div className="factory-detail__processing">
                      {selectedFactory.processing.map((route) => (
                        <div
                          key={route.route_id}
                          className="factory-detail__processing-route"
                        >
                          <div className="factory-detail__processing-top">
                            <span className="factory-detail__route-id mono">
                              {route.route_id || 'ROUTE'}
                            </span>

                            <span className="factory-detail__route-cost mono">
                              ₹
                              {formatNumber(
                                route.processing_cost_per_tonne,
                                2
                              )}
                              /T
                            </span>
                          </div>

                          <div className="factory-detail__route-chain">
                            <span>
                              {route.input_material_name || 'Input'}
                            </span>
                            <span className="mono">→</span>
                            <span>
                              {route.output_material_name || 'Output'}
                            </span>
                          </div>

                          <p>
                            {route.description ||
                              'Processing route registered for this node.'}
                          </p>

                          <div className="factory-detail__route-output">
                            {route.output_moisture_percent != null && (
                              <span className="mono">
                                OUTPUT MOIST{' '}
                                {formatNumber(
                                  route.output_moisture_percent,
                                  1
                                )}
                                %
                              </span>
                            )}

                            {route.output_purity_percent != null && (
                              <span className="mono">
                                OUTPUT PURITY{' '}
                                {formatNumber(
                                  route.output_purity_percent,
                                  1
                                )}
                                %
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="factory-detail__empty-line">
                      No processing routes recorded.
                    </div>
                  )}
                </section>
              </div>
            )}

            <footer className="factory-detail__footer">
              <span className="mono">
                FACTORY REGISTRY / NODE DETAIL
              </span>

              <button
                type="button"
                onClick={closeDetail}
              >
                CLOSE
              </button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  )
}