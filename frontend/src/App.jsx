import HealthBadge from './components/HealthBadge.jsx'
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
    agents, timeline, decision, phase, error, run, maxHops,
    graph, isSimulated, baseWasteDna, applySimulation, clearSimulation,
  } = usePipeline()
  const isRunning = phase === 'running'

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="app-header__title">CIRCULO</div>
          <div className="app-header__tagline label-caps">Agentic Industrial Symbiosis Engine</div>
        </div>
        <HealthBadge />
      </header>

      <main className="app-main">
        <section className="app-main__left">
          <UploadPanel onRun={run} disabled={isRunning} />
          <AgentStatusRail agents={agents} />
          {error && <div className="app-error">{error}</div>}
          <ActivityTimeline events={timeline} />
        </section>

        <aside className="app-main__right">
          <DecisionSummary decision={isSimulated ? graph?.decision : decision} />
        </aside>
      </main>

      <section className="app-graph-row">
        <RouteGraph
          wasteDna={graph?.wasteDna}
          discovery={graph?.discovery}
          impactPerRoute={graph?.impactPerRoute}
          decision={graph?.decision}
        />
        <WhatIfPanel
          wasteDna={baseWasteDna}
          maxHops={maxHops}
          onResult={applySimulation}
          onReset={clearSimulation}
        />
      </section>
    </div>
  )
}