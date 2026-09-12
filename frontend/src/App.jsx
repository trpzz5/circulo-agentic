import HealthBadge from './components/HealthBadge.jsx'
import Sidebar from './components/Sidebar.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import AgentStatusRail from './components/AgentStatusRail.jsx'
import ActivityTimeline from './components/ActivityTimeline.jsx'
import DecisionSummary from './components/DecisionSummary.jsx'
import RouteGraph from './components/RouteGraph.jsx'
import WhatIfPanel from './components/WhatIfPanel.jsx'
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
  } = usePipeline()

  const isRunning = phase === 'running'

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-shell">
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

        <main className="app-main">
          <section className="app-main__left">
            <div
              id="analysis-input"
              className="app-section-anchor"
            />

            <UploadPanel
              onRun={run}
              disabled={isRunning}
            />

            <AgentStatusRail agents={agents} />

            {error && (
              <div className="app-error">
                <span className="app-error__label mono">
                  PIPELINE ERROR
                </span>

                <span>{error}</span>
              </div>
            )}

            <div
              id="memory"
              className="app-section-anchor"
            />

            <ActivityTimeline events={timeline} />
          </section>

          <aside
            id="decision"
            className="app-main__right"
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

        <section className="app-graph-row">
          <div
            id="network"
            className="app-graph-container"
          >
            <RouteGraph
              wasteDna={graph?.wasteDna}
              discovery={graph?.discovery}
              impactPerRoute={graph?.impactPerRoute}
              decision={graph?.decision}
            />
          </div>

          <div
            id="what-if"
            className="app-simulator-container"
          >
            <WhatIfPanel
              wasteDna={baseWasteDna}
              maxHops={maxHops}
              onResult={applySimulation}
              onReset={clearSimulation}
            />
          </div>
        </section>
      </div>
    </div>
  )
}