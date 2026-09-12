import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildGraphElements } from '../utils/buildGraph.jsx'
import './RouteGraph.css'

export default function RouteGraph({
  wasteDna,
  discovery,
  impactPerRoute,
  decision,
}) {
  const { nodes, edges } = useMemo(
    () =>
      buildGraphElements({
        wasteDna,
        discovery,
        impactPerRoute,
        decision,
      }),
    [wasteDna, discovery, impactPerRoute, decision]
  )

  if (!wasteDna || !discovery) {
    return (
      <div className="route-graph panel route-graph--empty">
        <div className="route-graph__empty-mark">
          ◇
        </div>

        <span className="label-caps">
          Industrial Network
        </span>

        <p className="route-graph__placeholder">
          Run an analysis to visualize the route network.
        </p>

        <span className="route-graph__empty-status mono">
          NETWORK STANDBY
        </span>
      </div>
    )
  }

  const recommendedRoute =
    decision?.recommended_route_id

  const hopCount =
    recommendedRoute
      ?.split('→')
      .filter(Boolean)
      .length

  return (
    <div className="route-graph panel">
      <div className="route-graph__header">
        <div className="route-graph__title">
          <span className="label-caps">
            Industrial Network
          </span>

          <span className="route-graph__status">
            <span className="route-graph__status-dot" />
            ROUTE ACTIVE
          </span>
        </div>

        <div className="route-graph__meta">
          {hopCount > 1 && (
            <span className="mono">
              {hopCount - 1} HOPS
            </span>
          )}

          <span className="route-graph__legend">
            <span className="route-graph__legend-item">
              <span className="route-graph__dot route-graph__dot--source" />
              Source
            </span>

            <span className="route-graph__legend-item">
              <span className="route-graph__dot route-graph__dot--processor" />
              Processor
            </span>

            <span className="route-graph__legend-item">
              <span className="route-graph__dot route-graph__dot--recommended" />
              Recommended
            </span>

            <span className="route-graph__legend-item">
              <span className="route-graph__dot route-graph__dot--rejected" />
              Rejected
            </span>
          </span>
        </div>
      </div>

      <div className="route-graph__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.45,
            maxZoom: 1.15,
          }}
          proOptions={{
            hideAttribution: true,
          }}
        >
          <Background
            color="#232a35"
            gap={24}
            size={1}
          />

          <Controls
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {recommendedRoute && (
        <div className="route-graph__footer">
          <span className="label-caps">
            Recommended Route
          </span>

          <span
            className="route-graph__footer-route mono"
            title={recommendedRoute}
          >
            {recommendedRoute}
          </span>
        </div>
      )}
    </div>
  )
}