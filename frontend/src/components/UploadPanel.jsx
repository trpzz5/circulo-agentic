import { useRef, useState } from 'react'
import './UploadPanel.css'

const GOLDEN_PATH_TEXT = `Material: Foundry Sand
Quantity: 20 tonnes/month
Moisture: 12%
Purity: 94%
Location: Mangalore
Source Factory: ABC Foundry
Embedded Carbon: 1200 kg CO2e`

export default function UploadPanel({ onRun, disabled }) {
  const [mode, setMode] = useState('text') // 'text' | 'file'
  const [rawText, setRawText] = useState('')
  const [file, setFile] = useState(null)
  const [maxHops, setMaxHops] = useState(2)
  const fileInputRef = useRef(null)

  const canRun = !disabled && (mode === 'text' ? rawText.trim().length > 0 : !!file)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canRun) return
    onRun(mode === 'file' ? { file, maxHops } : { rawText, maxHops })
  }

  return (
    <form className="upload-panel panel" onSubmit={handleSubmit}>
      <div className="upload-panel__header">
        <span className="label-caps">Waste Manifest Input</span>
        <div className="upload-panel__tabs">
          <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>
            Paste Text
          </button>
          <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
            Upload PDF
          </button>
        </div>
      </div>

      {mode === 'text' ? (
        <textarea
          className="upload-panel__textarea"
          placeholder="Material: ...&#10;Quantity: ... tonnes/month&#10;Moisture: ...%&#10;Purity: ...%&#10;Location: ...&#10;Source Factory: ..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          disabled={disabled}
        />
      ) : (
        <div className="upload-panel__file">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={disabled}
          />
          {file && <span className="upload-panel__filename">{file.name}</span>}
        </div>
      )}

      <div className="upload-panel__footer">
        <label className="upload-panel__hops">
          <span className="label-caps">Max Hops</span>
          <select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))} disabled={disabled}>
            <option value={1}>1 — Direct only</option>
            <option value={2}>2 — Multi-hop</option>
            <option value={3}>3 — Extended</option>
          </select>
        </label>

        <button
          type="button"
          className="upload-panel__sample"
          disabled={disabled}
          onClick={() => { setMode('text'); setRawText(GOLDEN_PATH_TEXT) }}
        >
          Load Golden Path Sample
        </button>

        <button type="submit" className="upload-panel__run" disabled={!canRun}>
          {disabled ? 'ANALYZING…' : 'RUN ANALYSIS'}
        </button>
      </div>
    </form>
  )
}