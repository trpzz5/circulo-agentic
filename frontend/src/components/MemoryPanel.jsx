import { useEffect, useMemo, useState } from 'react'
import { getMemory } from '../services/api.js'
import './MemoryPanel.css'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatNumber(value, digits = 1) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return '—'
  }

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: digits,
  }).format(number)
}

function normalizeOutcome(value) {
  const outcome = String(value || '').toLowerCase()

  if (
    outcome.includes('accept') ||
    outcome.includes('success') ||
    outcome.includes('approved')
  ) {
    return 'accepted'
  }

  if (
    outcome.includes('reject') ||
    outcome.includes('fail') ||
    outcome.includes('declin')
  ) {
    return 'rejected'
  }

  return 'other'
}

function getConstraintLabel(record) {
  const observed = Number(record?.observed_percent)
  const limit = Number(record?.limit_percent)

  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(limit)
  ) {
    return null
  }

  const outcome = normalizeOutcome(record.outcome)

  if (outcome === 'rejected') {
    return `Observed ${formatNumber(observed)}% / Limit ${formatNumber(limit)}%`
  }

  return `Observed ${formatNumber(observed)}% / Limit ${formatNumber(limit)}%`
}

export default function MemoryPanel() {
  const [records, setRecords] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function loadMemory() {
      try {
        setStatus('loading')
        setError(null)

        const data = await getMemory()

        if (!active) return

        setRecords(
          Array.isArray(data)
            ? data
            : []
        )

        setStatus('ready')
      } catch (err) {
        if (!active) return

        setError(
          err.message ||
            'Failed to load persistent memory.'
        )

        setStatus('error')
      }
    }

    loadMemory()

    return () => {
      active = false
    }
  }, [])

  const acceptedCount = useMemo(
    () =>
      records.filter(
        (record) =>
          normalizeOutcome(record.outcome) ===
          'accepted'
      ).length,
    [records]
  )

  const rejectedCount = useMemo(
    () =>
      records.filter(
        (record) =>
          normalizeOutcome(record.outcome) ===
          'rejected'
      ).length,
    [records]
  )

  const acceptanceRate =
    records.length > 0
      ? (acceptedCount / records.length) * 100
      : 0

  const filteredRecords = useMemo(() => {
    const normalized =
      query.trim().toLowerCase()

    return records.filter((record) => {
      const outcome =
        normalizeOutcome(record.outcome)

      if (
        filter !== 'all' &&
        outcome !== filter
      ) {
        return false
      }

      if (!normalized) {
        return true
      }

      return [
        record.factory_name,
        record.factory_id,
        record.material_name,
        record.material_id,
        record.source_factory,
        record.outcome,
        record.reason,
        record.notes,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(normalized)
        )
    })
  }, [
    records,
    query,
    filter,
  ])

  return (
    <section className="memory-panel panel">
      <header className="memory-panel__header">
        <div>
          <div className="memory-panel__eyebrow">
            <span className="label-caps">
              Persistent Memory
            </span>

            <span className="memory-panel__live mono">
              READ ONLY
            </span>
          </div>

          <h2 className="memory-panel__title">
            Agent precedent
          </h2>

          <p className="memory-panel__subtitle">
            Historical route outcomes available to
            the decision pipeline.
          </p>
        </div>

        <div className="memory-panel__health">
          <span className="memory-panel__health-dot" />

          <div>
            <span className="label-caps">
              Memory Store
            </span>

            <strong className="mono">
              {status === 'ready'
                ? 'ONLINE'
                : status === 'error'
                  ? 'ERROR'
                  : 'SYNC'}
            </strong>
          </div>
        </div>
      </header>

      <div className="memory-panel__stats">
        <div className="memory-panel__stat memory-panel__stat--primary">
          <span className="memory-panel__stat-value mono">
            {records.length}
          </span>

          <span className="label-caps">
            Total Records
          </span>
        </div>

        <div className="memory-panel__stat">
          <span className="memory-panel__stat-value memory-panel__stat-value--accepted mono">
            {acceptedCount}
          </span>

          <span className="label-caps">
            Accepted
          </span>
        </div>

        <div className="memory-panel__stat">
          <span className="memory-panel__stat-value memory-panel__stat-value--rejected mono">
            {rejectedCount}
          </span>

          <span className="label-caps">
            Rejected
          </span>
        </div>

        <div className="memory-panel__stat">
          <span className="memory-panel__stat-value mono">
            {formatNumber(acceptanceRate)}%
          </span>

          <span className="label-caps">
            Acceptance
          </span>
        </div>
      </div>

      <div className="memory-panel__toolbar">
        <div className="memory-panel__search">
          <span className="memory-panel__search-icon mono">
            /
          </span>

          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search precedent..."
            aria-label="Search persistent memory"
          />

          {query && (
            <button
              type="button"
              className="memory-panel__clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="memory-panel__filters">
          <button
            type="button"
            className={`memory-panel__filter ${
              filter === 'all'
                ? 'memory-panel__filter--active'
                : ''
            }`}
            onClick={() => setFilter('all')}
          >
            ALL
          </button>

          <button
            type="button"
            className={`memory-panel__filter ${
              filter === 'accepted'
                ? 'memory-panel__filter--active memory-panel__filter--accepted'
                : ''
            }`}
            onClick={() =>
              setFilter('accepted')
            }
          >
            ACCEPTED
          </button>

          <button
            type="button"
            className={`memory-panel__filter ${
              filter === 'rejected'
                ? 'memory-panel__filter--active memory-panel__filter--rejected'
                : ''
            }`}
            onClick={() =>
              setFilter('rejected')
            }
          >
            REJECTED
          </button>
        </div>

        <span className="memory-panel__source mono">
          MEMORY STORE / PERSISTENT
        </span>
      </div>

      {status === 'loading' && (
        <div className="memory-panel__state">
          <span className="memory-panel__state-dot" />

          <span>
            Loading agent precedent...
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="memory-panel__state memory-panel__state--error">
          <span className="mono">
            MEMORY ERROR
          </span>

          <span>{error}</span>
        </div>
      )}

      {status === 'ready' &&
        filteredRecords.length === 0 && (
          <div className="memory-panel__empty">
            <div className="memory-panel__empty-mark">
              ∅
            </div>

            <span className="label-caps">
              No matching precedent
            </span>

            <p>
              No memory records match the current
              search and outcome filter.
            </p>

            {(query || filter !== 'all') && (
              <button
                type="button"
                className="memory-panel__empty-reset"
                onClick={() => {
                  setQuery('')
                  setFilter('all')
                }}
              >
                RESET FILTERS
              </button>
            )}
          </div>
        )}

      {status === 'ready' &&
        filteredRecords.length > 0 && (
          <div className="memory-panel__records">
            <div className="memory-panel__records-header">
              <span className="label-caps">
                Historical Precedent
              </span>

              <span className="mono">
                {filteredRecords.length
                  .toString()
                  .padStart(2, '0')}{' '}
                MATCHED
              </span>
            </div>

            <div className="memory-panel__table-wrap">
              <table className="memory-panel__table">
                <thead>
                  <tr>
                    <th>Outcome</th>
                    <th>Industrial Node</th>
                    <th>Material</th>
                    <th>Constraint</th>
                    <th>Reason</th>
                    <th>Recorded</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record, index) => {
                      const outcome =
                        normalizeOutcome(
                          record.outcome
                        )

                      const constraint =
                        getConstraintLabel(
                          record
                        )

                      return (
                        <tr
                          key={
                            record.id ||
                            `${record.factory_id}-${record.material_id}-${index}`
                          }
                        >
                          <td>
                            <span
                              className={`memory-panel__outcome memory-panel__outcome--${outcome}`}
                            >
                              <span className="memory-panel__outcome-dot" />

                              {String(
                                record.outcome ||
                                  'UNKNOWN'
                              ).toUpperCase()}
                            </span>
                          </td>

                          <td>
                            <div className="memory-panel__factory">
                              {record.factory_name ||
                                '—'}
                            </div>

                            {record.factory_id && (
                              <span className="memory-panel__secondary mono">
                                {
                                  record.factory_id
                                }
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="memory-panel__material">
                              {record.material_name ||
                                '—'}
                            </div>

                            {record.material_id && (
                              <span className="memory-panel__secondary mono">
                                {
                                  record.material_id
                                }
                              </span>
                            )}
                          </td>

                          <td>
                            {constraint ? (
                              <span className="memory-panel__constraint mono">
                                {constraint}
                              </span>
                            ) : (
                              <span className="memory-panel__secondary">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="memory-panel__reason">
                              {record.reason ||
                                'No reason recorded.'}
                            </div>

                            {record.notes && (
                              <div className="memory-panel__notes">
                                {record.notes}
                              </div>
                            )}
                          </td>

                          <td>
                            <span className="memory-panel__date mono">
                              {formatDate(
                                record.date
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <footer className="memory-panel__footer">
        <div className="memory-panel__footer-status">
          <span className="memory-panel__footer-dot" />

          <span className="mono">
            {status === 'ready'
              ? 'PERSISTENT PRECEDENT AVAILABLE'
              : status === 'error'
                ? 'MEMORY STORE UNAVAILABLE'
                : 'SYNCING MEMORY STORE'}
          </span>
        </div>

        <span className="memory-panel__footer-note label-caps">
          Simulation runs do not modify this store
        </span>
      </footer>
    </section>
  )
}