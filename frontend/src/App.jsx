import HealthBadge from './components/HealthBadge.jsx'
import Sidebar from './components/Sidebar.jsx'
import SystemStatusBar from './components/SystemStatusBar.jsx'
import SystemState from './components/SystemState.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import AgentStatusRail from './components/AgentStatusRail.jsx'
import ActivityTimeline from './components/ActivityTimeline.jsx'
import DecisionSummary from './components/DecisionSummary.jsx'
import RouteGraph from './components/RouteGraph.jsx'
import WhatIfPanel from './components/WhatIfPanel.jsx'
import MemoryPanel from './components/MemoryPanel.jsx'
import FactoriesPanel from './components/FactoriesPanel.jsx'
import { usePipeline } from './hooks/usePipeline.js'
import './App.css'

export default function App() {
  const {
    agents,
    timeline,
    decision,
    phase,
    error,
    run,
    maxHops,
    graph,
    isSimulated,
    baseWasteDna,
    applySimulation,
    clearSimulation,
    reset,
  } = usePipeline()

  const isRunning = phase === 'running'

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-shell">

        {/* =====================================================
            HEADER
            ===================================================== */}

        <header
          id="dashboard"
          className="app-header"
        >
          <div className="app-header__identity">
            <div className="app-header__eyebrow mono">
              CIRCULO / COMMAND CENTER
            </div>

            <div className="app-header__title">
              Industrial Symbiosis Engine
            </div>

            <div className="app-header__tagline label-caps">
              Agentic material intelligence
            </div>
          </div>

          <HealthBadge />
        </header>

        {/* =====================================================
            SYSTEM STATUS
            ===================================================== */}

        <SystemStatusBar
          phase={phase}
          isSimulated={isSimulated}
        />

        {/* =====================================================
            MAIN COMMAND CENTER
            ===================================================== */}

        <main className="app-main">

          {/* -------------------------------------------------
              ANALYSIS INPUT — FULL WIDTH
              ------------------------------------------------- */}

          <section className="app-analysis-input">
            <div
              id="analysis-input"
              className="app-section-anchor"
            />

            <UploadPanel
              onRun={run}
              disabled={isRunning}
            />
          </section>

          {/* -------------------------------------------------
              AGENT ORCHESTRATION — FULL WIDTH
              ------------------------------------------------- */}

          <section className="app-orchestration">
            <AgentStatusRail
              agents={agents}
            />
          </section>

          {/* -------------------------------------------------
              LIVE AGENT ACTIVITY — FULL WIDTH
              ------------------------------------------------- */}

          <section className="app-live-activity">
            {error && (
              <div className="app-error">
                <div className="app-error__header">
                  <span className="mono">
                    PIPELINE ERROR
                  </span>

                  <button
                    type="button"
                    className="app-error__dismiss"
                    onClick={reset}
                  >
                    DISMISS
                  </button>
                </div>

                <span>
                  {error}
                </span>

                <span className="app-error__hint">
                  Verify that the CIRCULO API is running
                  and retry the analysis.
                </span>
              </div>
            )}

            <ActivityTimeline
              events={timeline}
            />

            {!isRunning &&
              phase === 'idle' &&
              timeline.length === 0 && (
                <SystemState
                  type="standby"
                  compact
                  title="Pipeline ready"
                  message="Submit an industrial material manifest to begin autonomous analysis."
                />
              )}

            {isRunning &&
              timeline.length === 0 && (
                <SystemState
                  type="loading"
                  compact
                  title="Pipeline initializing"
                  message="Waiting for the first agent event from the analysis stream."
                />
              )}
          </section>

          {/* -------------------------------------------------
              DECISION INTELLIGENCE — FULL WIDTH
              ------------------------------------------------- */}

          <aside
            id="decision"
            className="app-decision"
          >
            <DecisionSummary
              decision={
                isSimulated
                  ? graph?.decision
                  : decision
              }
            />
          </aside>

        </main>

        {/* =====================================================
            INDUSTRIAL NETWORK + WHAT-IF
            ===================================================== */}

        <section className="app-graph-row">

          <div
            id="network"
            className="app-graph-container"
          >
            <RouteGraph
              wasteDna={graph?.wasteDna}
              discovery={graph?.discovery}
              impactPerRoute={
                graph?.impactPerRoute
              }
              decision={graph?.decision}
            />
          </div>

          <div
            id="what-if"
            className="app-simulator-container"
          >
            <WhatIfPanel
              baseWasteDna={baseWasteDna}
              maxHops={maxHops}
              onApply={applySimulation}
              onClear={clearSimulation}
              isSimulated={isSimulated}
            />
          </div>

        </section>

        {/* =====================================================
            MEMORY
            ===================================================== */}

        <section
          id="memory"
          className="app-memory-row"
        >
          <MemoryPanel />
        </section>

        {/* =====================================================
            FACTORIES
            ===================================================== */}

        <section
          id="factories"
          className="app-factories-row"
        >
          <FactoriesPanel />
        </section>

      </div>
    </div>
  )
}