import { useEffect, useRef } from 'react'
import './ActivityTimeline.css'

const AGENT_LABELS = {
  dna: 'DNA',
  discovery: 'DISCOVERY',
  impact: 'IMPACT',
  decision: 'DECISION',
  pipeline: 'PIPELINE',
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour12: false,
    })
  } catch {
    return ''
  }
}

function normalizeAgent(agent) {
  if (!agent) return 'SYSTEM'

  const key = String(agent).toLowerCase().trim()

  return AGENT_LABELS[key] || String(agent).toUpperCase()
}

function normalizeStatus(status) {
  if (!status) return 'waiting'
  return String(status).toLowerCase().trim()
}

export default function ActivityTimeline({ events = [] }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [events.length])

  const latestEvent = events.length > 0
    ? events[events.length - 1]
    : null

  const runningCount = events.filter(
    (event) => normalizeStatus(event.status) === 'running'
  ).length

  return (
    <div className="timeline panel">
      <div className="timeline__header">
        <div className="timeline__header-main">
          <span className="label-caps">Live Agent Activity</span>

          <span className="timeline__live">
            LIVE
          </span>
        </div>

        <div className="timeline__header-meta">
          <span className="mono">
            {events.length.toString().padStart(2, '0')} EVENTS
          </span>

          {runningCount > 0 && (
            <span className="timeline__running mono">
              {runningCount} ACTIVE
            </span>
          )}
        </div>
      </div>

      <div className="timeline__body">
        {events.length === 0 && (
          <div className="timeline__empty">
            <span className="timeline__empty-dot" />
            <span>No activity yet. Run an analysis to begin.</span>
          </div>
        )}

        {events.map((event, i) => {
          const status = normalizeStatus(event.status)
          const agent = normalizeAgent(event.agent)
          const isLatest = i === events.length - 1
          const note = event.note || event.activity || 'System activity'

          return (
            <div
              key={`${event.timestamp || 'event'}-${i}`}
              className={[
                'timeline__row',
                `timeline__row--${status}`,
                isLatest ? 'timeline__row--latest' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="timeline__time mono">
                {formatTime(event.timestamp)}
              </span>

              <span className="timeline__agent mono">
                {agent}
              </span>

              <span className="timeline__status">
                {status}
              </span>

              <span className="timeline__note" title={note}>
                {note}
              </span>
            </div>
          )
        })}

        <div ref={endRef} />
      </div>

      {latestEvent && (
        <div className="timeline__footer">
          <span className="timeline__footer-label label-caps">
            Latest
          </span>

          <span className="timeline__footer-note">
            {latestEvent.note ||
              latestEvent.activity ||
              'System activity'}
          </span>
        </div>
      )}
    </div>
  )
}