import './SystemState.css'

const CONFIG = {
  loading: {
    label: 'SYNCING',
    title: 'Synchronizing system data',
    tone: 'loading',
  },
  error: {
    label: 'ERROR',
    title: 'System data unavailable',
    tone: 'error',
  },
  empty: {
    label: 'EMPTY',
    title: 'No data available',
    tone: 'empty',
  },
  standby: {
    label: 'STANDBY',
    title: 'Awaiting pipeline activity',
    tone: 'standby',
  },
}

export default function SystemState({
  type = 'standby',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}) {
  const config = CONFIG[type] || CONFIG.standby

  return (
    <div
      className={`system-state system-state--${config.tone} ${
        compact ? 'system-state--compact' : ''
      }`}
    >
      <div className="system-state__indicator">
        <span className="system-state__indicator-core" />
      </div>

      <div className="system-state__content">
        <span className="system-state__label mono">
          {config.label}
        </span>

        <strong className="system-state__title">
          {title || config.title}
        </strong>

        {message && (
          <p className="system-state__message">
            {message}
          </p>
        )}

        {actionLabel && onAction && (
          <button
            type="button"
            className="system-state__action"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}