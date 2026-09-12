import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { buildGraphElements } from '../utils/buildGraph.js'
import './RouteGraph.css'

export default function RouteGraph({ wasteDna, discovery, impactPerRoute, decision }) {
  const { nodes, edges } = useMemo(
    () => buildGraphElements({ wasteDna, discovery, impactPerRoute, decision }),
    [wasteDna, discovery, impactPerRoute, decision]
  )

  if (!wasteDna || !discovery) {
    return (
      <div className="route-graph panel route-graph--empty">
        <span className="label-caps">Network Graph</span>
        <p className="route-graph__placeholder">Run an analysis to visualize the route network.</p>
      </div>
    )
  }

  return (
    <div className="route-graph panel">
      <div className="route-graph__header">
        <span className="label-caps">Network Graph</span>
        <span className="route-graph__legend">
          <span className="route-graph__dot route-graph__dot--source" />Source
          <span className="route-graph__dot route-graph__dot--processor" />Processor
          <span className="route-graph__dot route-graph__dot--recommended" />Recommended
          <span className="route-graph__dot route-graph__dot--rejected" />Rejected
        </span>
      </div>
      <div className="route-graph__canvas">
        <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
          <Background color="#232a35" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={() => '#171c25'}
            maskColor="rgba(10,13,18,0.7)"
            style={{ background: '#12161d' }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}