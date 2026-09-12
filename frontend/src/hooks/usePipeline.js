import { useCallback, useRef, useState } from 'react'
import { getRunResult, startAnalysis, subscribeToRun, uploadManifest } from '../services/api.js'

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
 *
 * Phase 9 additions: once a run completes, fetches the full result (Waste
 * DNA + Discovery + Impact + Decision) so the network graph has everything
 * it needs — the SSE 'decision' event alone only carries the Decision
 * Agent's own payload, not the routes/hops the graph needs to draw. It also
 * tracks an optional "simulated" view, produced by the What-If panel, that
 * temporarily overrides what the graph/decision panel render without ever
 * touching the real analysis result underneath.
 */
export function usePipeline() {
  const [agents, setAgents] = useState(initialAgentState())
  const [timeline, setTimeline] = useState([])
  const [decision, setDecision] = useState(null)
  const [runId, setRunId] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | running | complete | failed
  const [error, setError] = useState(null)
  const [maxHops, setMaxHops] = useState(2)

  // { wasteDna, discovery, impactPerRoute, decision } | null
  const [analysis, setAnalysis] = useState(null)
  const [simulated, setSimulated] = useState(null)

  const unsubscribeRef = useRef(null)
  const runIdRef = useRef(null)

  const reset = useCallback(() => {
    unsubscribeRef.current?.()
    setAgents(initialAgentState())
    setTimeline([])
    setDecision(null)
    setRunId(null)
    setPhase('idle')
    setError(null)
    setAnalysis(null)
    setSimulated(null)
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

  const loadFullResult = useCallback(async (id) => {
    try {
      const { result } = await getRunResult(id)
      const wasteDna = result?.agents?.dna?.data ?? null
      const discovery = result?.agents?.discovery?.data ?? null
      const impactPerRoute = result?.agents?.impact?.data?.per_route ?? []
      const decisionData = result?.agents?.decision?.data ?? null
      if (wasteDna && discovery) {
        setAnalysis({ wasteDna, discovery, impactPerRoute, decision: decisionData })
      }
    } catch (err) {
      // Non-fatal: the timeline and decision panel already have everything
      // they need from the SSE stream. Only the graph/what-if panel need
      // this extra fetch, so a failure here degrades gracefully rather than
      // surfacing as a run failure.
      console.error('Failed to load full run result for graph rendering', err)
    }
  }, [])

  const run = useCallback(async ({ file, rawText, maxHops: hops = 2 }) => {
    reset()
    setPhase('running')
    setError(null)
    setMaxHops(hops)

    try {
      let manifestId = null
      if (file) {
        const uploadResult = await uploadManifest(file)
        manifestId = uploadResult.manifest_id
      }

      const ack = await startAnalysis({ rawText, manifestId, maxHops: hops })
      setRunId(ack.run_id)
      runIdRef.current = ack.run_id

      unsubscribeRef.current = subscribeToRun(ack.run_id, {
        onEvent: handleEvent,
        onDone: () => {
          setPhase((p) => (p === 'failed' ? p : 'complete'))
          if (runIdRef.current) loadFullResult(runIdRef.current)
        },
        onError: () => setError('Lost connection to the analysis stream.'),
      })
    } catch (err) {
      setError(err.message || 'Failed to start analysis.')
      setPhase('failed')
    }
  }, [handleEvent, reset, loadFullResult])

  const applySimulation = useCallback((simResult) => {
    setSimulated({
      wasteDna: simResult.waste_dna,
      discovery: simResult.discovery?.data ?? null,
      impactPerRoute: simResult.impact?.data?.per_route ?? [],
      decision: simResult.decision?.data ?? null,
    })
  }, [])

  const clearSimulation = useCallback(() => setSimulated(null), [])

  const graph = simulated ?? analysis

  return {
    agents, timeline, decision, runId, phase, error, run, reset, maxHops,
    graph,
    isSimulated: simulated !== null,
    baseWasteDna: analysis?.wasteDna ?? null,
    applySimulation, clearSimulation,
  }
}