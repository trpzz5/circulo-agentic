/**
 * Builds React Flow-compatible {nodes, edges} from one analysis result's
 * Discovery + Impact + Decision payloads (the exact shapes returned by
 * GET /api/routes/{run_id} and POST /api/simulate).
 *
 * Pure function — no React, no side effects — so it works identically for a
 * completed real run and a live what-if simulation, and is trivial to unit
 * test on its own.
 */

const COLORS = {
  source: '#f5a524',
  processor: '#4a9df5',
  recommended: '#2fd97a',
  rejected: '#ef4a5c',
  viable: '#6b7688',
}

const COLUMN_X = { source: 40, processor: 340, destination: 640 }
const ROW_GAP = 90

function nodeStyle(color, { bold = false } = {}) {
  return {
    background: '#171c25',
    color: '#e6ebf2',
    border: `${bold ? 2 : 1}px solid ${color}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    minWidth: 160,
    textAlign: 'center',
  }
}

function edgeStyle(color, { bold = false, dashed = false } = {}) {
  return {
    stroke: color,
    strokeWidth: bold ? 3 : 1.5,
    strokeDasharray: dashed ? '6 4' : undefined,
  }
}

/**
 * @param {object} params
 * @param {import('../../../backend/app/api/schemas/waste').WasteDNA} params.wasteDna
 * @param {{direct_matches: object[], multi_hop_routes: object[]}} params.discovery
 * @param {object[]} [params.impactPerRoute]
 * @param {{recommended_route_id: string|null}} [params.decision]
 */
export function buildGraphElements({ wasteDna, discovery, impactPerRoute = [], decision }) {
  if (!wasteDna || !discovery) return { nodes: [], edges: [] }

  const recommendedKey = decision?.recommended_route_id ?? null
  const nodesById = new Map()
  const edges = []
  const columnCounts = { source: 0, processor: 0, destination: 0 }

  function placeNode(id, label, column, color, extra = {}) {
    if (nodesById.has(id)) return nodesById.get(id)
    const row = columnCounts[column]++
    const node = {
      id,
      data: { label },
      position: { x: COLUMN_X[column], y: 40 + row * ROW_GAP },
      style: nodeStyle(color, extra),
      draggable: true,
    }
    nodesById.set(id, node)
    return node
  }

  placeNode('source', wasteDna.source_factory || 'Source', 'source', COLORS.source, { bold: true })

  const impactByKey = new Map(impactPerRoute.map((r) => [r.route_key || r.destination_factory_id, r]))

  // Direct matches: source -> destination (rejected candidates included —
  // showing what was refused, and why, is as important as the winner).
  for (const match of discovery.direct_matches ?? []) {
    const key = match.factory_id
    const isChosen = recommendedKey === key
    const isRejected = match.status !== 'viable'
    const color = isChosen ? COLORS.recommended : isRejected ? COLORS.rejected : COLORS.viable

    placeNode(key, match.factory_name, 'destination', color, { bold: isChosen })

    edges.push({
      id: `source->${key}`,
      source: 'source',
      target: key,
      label: isRejected ? (match.reasons?.[0] ?? 'rejected') : `${Math.round(match.distance_km ?? 0)} km`,
      animated: isChosen,
      style: edgeStyle(color, { bold: isChosen, dashed: isRejected }),
      labelStyle: { fill: '#9aa5b5', fontSize: 10 },
      labelBgStyle: { fill: '#12161d' },
    })
  }

  // Multi-hop routes: source -> processor(s) -> destination.
  for (const route of discovery.multi_hop_routes ?? []) {
    const key = route.route_key
    const isChosen = recommendedKey === key
    const impact = impactByKey.get(key)
    const routeColor = isChosen ? COLORS.recommended : COLORS.viable

    let prevId = 'source'
    let lastEdgeId = null

    for (const hop of route.hops ?? []) {
      if (hop.role === 'source') continue

      const hopId = hop.factory_id
      const column = hop.role === 'processor' ? 'processor' : 'destination'
      const color = hop.role === 'processor' ? COLORS.processor : routeColor
      placeNode(hopId, hop.factory_name, column, color, { bold: isChosen })

      const edgeId = `${prevId}->${hopId}::${key}`
      const distance = hop.distance_from_previous_km
      edges.push({
        id: edgeId,
        source: prevId,
        target: hopId,
        label: distance != null ? `${Math.round(distance)} km` : undefined,
        animated: isChosen,
        style: edgeStyle(color, { bold: isChosen }),
        labelStyle: { fill: '#9aa5b5', fontSize: 10 },
        labelBgStyle: { fill: '#12161d' },
      })
      lastEdgeId = edgeId
      prevId = hopId
    }

    // Surface the ecosystem value on the final leg of the recommended route.
    if (isChosen && impact && lastEdgeId) {
      const lastEdge = edges.find((e) => e.id === lastEdgeId)
      if (lastEdge) {
        lastEdge.label = `Rs.${Math.round(impact.ecosystem_value.value).toLocaleString('en-IN')}`
      }
    }
  }

  return { nodes: Array.from(nodesById.values()), edges }
}