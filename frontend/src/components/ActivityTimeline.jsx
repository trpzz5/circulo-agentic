import { useEffect, useRef } from 'react'
import './ActivityTimeline.css'

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour12: false })
  } catch {
    return ''
  }
}

export default function ActivityTimeline({ events }) {
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [events.length])

  return (
    <div className="timeline panel">
      <div className="timeline__header label-caps">Event Stream</div>
      <div className="timeline__body">
        {events.length === 0 && <div className="timeline__empty">No activity yet. Run an analysis to begin.</div>}
        {events.map((event, i) => (
          <div key={i} className={`timeline__row timeline__row--${event.status}`}>
            <span className="timeline__time mono">{formatTime(event.timestamp)}</span>
            <span className="timeline__agent mono">{event.agent}</span>
            <span className="timeline__status">{event.status}</span>
            <span className="timeline__note">{event.note || event.activity}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}