import { useCallback, useRef, useState } from 'react'
import { startAnalysis, subscribeToRun, uploadManifest } from '../services/api.js'

const AGENT_ORDER = ['dna', 'discovery', 'impact', 'decision']

function initialAgentState() {
  return Object.fromEntries(
    AGENT_ORDER.map((name) => [name, { status: 'idle', activity: 'IDLE', note: null }])
  )
}

/**
 * Owns the entire lifecycle of one analysis run: kicking it off, listening
 * to its SSE stream, and exposing live-updating state for the UI to render.
 * This is the ONLY place that talks to the orchestration endpoints.
 */
export function usePipeline() {
  const [agents, setAgents] = useState(initialAgentState())
  const [timeline, setTimeline] = useState([])
  const [decision, setDecision] = useState(null)
  const [runId, setRunId] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | running | complete | failed
  const [error, setError] = useState(null)
  const unsubscribeRef = useRef(null)

  const reset = useCallback(() => {
    unsubscribeRef.current?.()
    setAgents(initialAgentState())
    setTimeline([])
    setDecision(null)
    setRunId(null)
    setPhase('idle')
    setError(null)
  }, [])

  const handleEvent = useCallback((event) => {
    setTimeline((prev) => [...prev, event])

    if (event.agent === 'pipeline') {
      setPhase(event.status === 'complete' ? 'complete' : event.status === 'failed' ? 'failed' : 'running')
      return
    }

    setAgents((prev) => ({
      ...prev,
      [event.agent]: { status: event.status, activity: event.activity, note: event.note },
    }))

    if (event.agent === 'decision' && event.status === 'complete' && event.data) {
      setDecision(event.data)
    }
  }, [])

  const run = useCallback(async ({ file, rawText, maxHops = 2 }) => {
    reset()
    setPhase('running')
    setError(null)

    try {
      let manifestId = null
      if (file) {
        const uploadResult = await uploadManifest(file)
        manifestId = uploadResult.manifest_id
      }

      const ack = await startAnalysis({ rawText, manifestId, maxHops })
      setRunId(ack.run_id)

      unsubscribeRef.current = subscribeToRun(ack.run_id, {
        onEvent: handleEvent,
        onDone: () => setPhase((p) => (p === 'failed' ? p : 'complete')),
        onError: () => setError('Lost connection to the analysis stream.'),
      })
    } catch (err) {
      setError(err.message || 'Failed to start analysis.')
      setPhase('failed')
    }
  }, [handleEvent, reset])

  return { agents, timeline, decision, runId, phase, error, run, reset }
}