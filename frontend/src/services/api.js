/**
 * Thin wrapper over the CIRCULO backend API. Every call here corresponds
 * exactly to a Phase 1-9 endpoint — nothing invented, nothing hidden.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Request failed with status ${response.status}`)
  }
  return response.json()
}

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`)
  return handleResponse(res)
}

export async function uploadManifest(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/upload-manifest`, { method: 'POST', body: formData })
  return handleResponse(res)
}

export async function startAnalysis({ rawText, manifestId, maxHops = 2 }) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raw_text: rawText || null,
      manifest_id: manifestId || null,
      max_hops: maxHops,
    }),
  })
  return handleResponse(res)
}

export async function getRunResult(runId) {
  const res = await fetch(`${API_BASE}/routes/${runId}`)
  return handleResponse(res)
}

export function subscribeToRun(runId, { onEvent, onDone, onError }) {
  const source = new EventSource(`${API_BASE}/stream/${runId}`)

  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data))
    } catch (err) {
      console.error('Malformed SSE event', err, message.data)
    }
  }

  source.addEventListener('done', () => {
    source.close()
    onDone?.()
  })

  source.onerror = (err) => {
    source.close()
    onError?.(err)
  }

  return () => source.close()
}

export async function getFactories() {
  const res = await fetch(`${API_BASE}/factories`)
  return handleResponse(res)
}

export async function getMemory() {
  const res = await fetch(`${API_BASE}/memory`)
  return handleResponse(res)
}

/**
 * Phase 9 — What-If Simulator. Re-runs Discovery -> Impact -> Decision for
 * an adjusted Waste DNA and returns the full result synchronously. Never
 * persisted to memory server-side (see backend/app/agents/decision_agent.py).
 */
export async function simulateWhatIf({ wasteDna, maxHops = 2 }) {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waste_dna: wasteDna, max_hops: maxHops }),
  })
  return handleResponse(res)
}