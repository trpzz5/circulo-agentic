import { useRef, useState } from 'react'
import './UploadPanel.css'

const GOLDEN_PATH_TEXT = `Material: Foundry Sand
Quantity: 20 tonnes/month
Moisture: 12%
Purity: 94%
Location: Mangalore
Source Factory: ABC Foundry
Embedded Carbon: 1200 kg CO2e
Max Hops: 2`

export default function UploadPanel({ onRun, disabled }) {
  const [mode, setMode] = useState('text')
  const [rawText, setRawText] = useState('')
  const [file, setFile] = useState(null)
  const [maxHops, setMaxHops] = useState(2)

  const fileInputRef = useRef(null)

  const canRun =
    !disabled &&
    (mode === 'text'
      ? rawText.trim().length > 0
      : !!file)

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!canRun) return

    if (mode === 'file') {
      onRun({
        file,
        maxHops,
      })
      return
    }

    onRun({
      rawText,
      maxHops,
    })
  }

  const handleLoadGoldenPath = () => {
    setMode('text')
    setRawText(GOLDEN_PATH_TEXT)
    setFile(null)
    setMaxHops(2)
  }

  const handleModeChange = (nextMode) => {
    if (disabled) return

    setMode(nextMode)

    if (nextMode === 'text') {
      setFile(null)
    }
  }

  return (
    <form
      className="upload-panel panel"
      onSubmit={handleSubmit}
    >
      {/* ─────────────────────────────────────────────────────────────
          HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="upload-panel__top">
        <div className="upload-panel__heading">
          <div className="upload-panel__eyebrow">
            Analysis Input
          </div>

          <div className="upload-panel__title-row">
            <h2 className="upload-panel__title">
              Industrial Waste Manifest
            </h2>

            <span className="upload-panel__status">
              <span className="upload-panel__status-dot" />
              {disabled ? 'ANALYSIS RUNNING' : 'AWAITING INPUT'}
            </span>
          </div>

          <p className="upload-panel__description">
            Define the industrial byproduct CIRCULO should route
            through the circular economy.
          </p>
        </div>

        <div className="upload-panel__tabs">
          <button
            type="button"
            className={
              mode === 'text'
                ? 'upload-panel__tab upload-panel__tab--active'
                : 'upload-panel__tab'
            }
            onClick={() => handleModeChange('text')}
            disabled={disabled}
          >
            <span className="upload-panel__tab-icon">⌘</span>
            Paste Text
          </button>

          <button
            type="button"
            className={
              mode === 'file'
                ? 'upload-panel__tab upload-panel__tab--active'
                : 'upload-panel__tab'
            }
            onClick={() => handleModeChange('file')}
            disabled={disabled}
          >
            <span className="upload-panel__tab-icon">↑</span>
            Upload PDF
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MANIFEST INPUT
      ───────────────────────────────────────────────────────────── */}
      <div className="upload-panel__manifest">
        <div className="upload-panel__manifest-header">
          <span className="upload-panel__manifest-label">
            Manifest Data
          </span>

          <span className="upload-panel__manifest-type">
            {mode === 'text' ? 'Structured Text' : 'PDF Document'}
          </span>
        </div>

        {mode === 'text' ? (
          <textarea
            className="upload-panel__textarea"
            placeholder={`Material: ...
Quantity: ... tonnes/month
Moisture: ...%
Purity: ...%
Location: ...
Source Factory: ...`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={disabled}
            spellCheck="false"
          />
        ) : (
          <div
            className={
              file
                ? 'upload-panel__file upload-panel__file--selected'
                : 'upload-panel__file'
            }
            onClick={() => {
              if (!disabled) {
                fileInputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            onKeyDown={(e) => {
              if (
                !disabled &&
                (e.key === 'Enter' || e.key === ' ')
              ) {
                fileInputRef.current?.click()
              }
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
              }}
              disabled={disabled}
            />

            <div className="upload-panel__file-icon">
              {file ? '✓' : '↑'}
            </div>

            <div className="upload-panel__file-content">
              <span className="upload-panel__file-title">
                {file
                  ? file.name
                  : 'Drop manifest PDF here or browse'}
              </span>

              <span className="upload-panel__file-subtitle">
                {file
                  ? 'PDF manifest ready for analysis'
                  : 'Supported format: PDF'}
              </span>
            </div>
          </div>
        )}

        {mode === 'text' && (
          <div className="upload-panel__manifest-footer">
            <span>
              DNA Agent will extract material properties automatically
            </span>

            <span className="upload-panel__character-count">
              {rawText.length} chars
            </span>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ROUTING DEPTH
      ───────────────────────────────────────────────────────────── */}
      <div className="upload-panel__routing">
        <div className="upload-panel__routing-heading">
          <div>
            <div className="upload-panel__section-label">
              Routing Depth
            </div>

            <div className="upload-panel__section-description">
              Maximum number of industrial transformation hops
            </div>
          </div>

          <div className="upload-panel__hop-value">
            {maxHops} {maxHops === 1 ? 'HOP' : 'HOPS'}
          </div>
        </div>

        <div className="upload-panel__hop-options">
          <button
            type="button"
            className={
              maxHops === 1
                ? 'upload-panel__hop upload-panel__hop--active'
                : 'upload-panel__hop'
            }
            onClick={() => setMaxHops(1)}
            disabled={disabled}
          >
            <span className="upload-panel__hop-number">
              01
            </span>

            <span className="upload-panel__hop-content">
              <strong>Direct</strong>
              <small>Waste → Buyer</small>
            </span>
          </button>

          <button
            type="button"
            className={
              maxHops === 2
                ? 'upload-panel__hop upload-panel__hop--active'
                : 'upload-panel__hop'
            }
            onClick={() => setMaxHops(2)}
            disabled={disabled}
          >
            <span className="upload-panel__hop-number">
              02
            </span>

            <span className="upload-panel__hop-content">
              <strong>Multi-hop</strong>
              <small>Waste → Processor → Buyer</small>
            </span>
          </button>

          <button
            type="button"
            className={
              maxHops === 3
                ? 'upload-panel__hop upload-panel__hop--active'
                : 'upload-panel__hop'
            }
            onClick={() => setMaxHops(3)}
            disabled={disabled}
          >
            <span className="upload-panel__hop-number">
              03
            </span>

            <span className="upload-panel__hop-content">
              <strong>Extended</strong>
              <small>Extended circular pathway</small>
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ACTION BAR
      ───────────────────────────────────────────────────────────── */}
      <div className="upload-panel__actions">
        <div className="upload-panel__actions-left">
          <button
            type="button"
            className="upload-panel__sample"
            disabled={disabled}
            onClick={handleLoadGoldenPath}
          >
            <span className="upload-panel__sample-icon">
              ↻
            </span>
            Load Golden Path
          </button>

          <span className="upload-panel__divider" />

          <div className="upload-panel__engine-status">
            <span className="upload-panel__engine-dot" />
            <span>Deterministic analysis engine</span>
          </div>
        </div>

        <button
          type="submit"
          className="upload-panel__run"
          disabled={!canRun}
        >
          <span>
            {disabled ? 'ANALYZING…' : 'RUN ANALYSIS'}
          </span>

          <span className="upload-panel__run-arrow">
            →
          </span>
        </button>
      </div>
    </form>
  )
}