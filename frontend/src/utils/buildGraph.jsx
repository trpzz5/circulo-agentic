const COLORS = {
  source: '#f5a524',
  processor: '#4a9df5',
  recommended: '#2fd97a',
  rejected: '#ef4a5c',
  viable: '#6b7688',
}

const COLUMN_X = {
  source: 40,
  processor: 360,
  destination: 700,
}

const ROW_GAP = 110

function text(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback
  }

  return String(value)
}

function firstValue(object, keys, fallback = null) {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ''
    ) {
      return object[key]
    }
  }

  return fallback
}

function factoryId(factory, fallback) {
  return text(
    firstValue(
      factory,
      [
        'factory_id',
        'id',
        'factoryId',
        'company_id',
        'companyId',
      ],
      fallback,
    ),
    fallback,
  )
}

function factoryName(factory, fallback = 'Factory') {
  return text(
    firstValue(
      factory,
      [
        'factory_name',
        'name',
        'factoryName',
        'company_name',
        'companyName',
      ],
      fallback,
    ),
    fallback,
  )
}

function nodeStyle(color, bold = false) {
  return {
    background: '#171c25',
    color: '#e6ebf2',
    border: `${bold ? 2 : 1}px solid ${color}`,
    borderRadius: 8,
    padding: '12px 16px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 12,
    minWidth: 180,
    maxWidth: 240,
    textAlign: 'center',
    boxShadow: bold
      ? `0 0 18px ${color}33`
      : '0 4px 16px rgba(0, 0, 0, 0.18)',
  }
}

function edgeStyle(color, bold = false, dashed = false) {
  return {
    stroke: color,
    strokeWidth: bold ? 3 : 1.5,
    strokeDasharray: dashed ? '6 4' : undefined,
  }
}

function normaliseRouteKey(route) {
  return text(
    firstValue(
      route,
      [
        'route_key',
        'route_id',
        'id',
        'routeId',
      ],
      '',
    ),
  )
}

function normaliseDirectMatches(discovery) {
  if (!discovery) return []

  const matches =
    discovery.direct_matches ??
    discovery.directMatches ??
    discovery.direct ??
    discovery.matches ??
    []

  return Array.isArray(matches) ? matches : []
}

function normaliseMultiHopRoutes(discovery) {
  if (!discovery) return []

  const routes =
    discovery.multi_hop_routes ??
    discovery.multiHopRoutes ??
    discovery.routes ??
    []

  return Array.isArray(routes) ? routes : []
}

function normaliseHops(route) {
  const hops =
    route?.hops ??
    route?.path ??
    route?.nodes ??
    []

  return Array.isArray(hops) ? hops : []
}

function getHopRole(hop, index, total) {
  const role = text(
    firstValue(
      hop,
      ['role', 'type', 'factory_role'],
      '',
    ),
  ).toLowerCase()

  if (role.includes('source')) return 'source'
  if (role.includes('processor')) return 'processor'
  if (role.includes('destination')) return 'destination'

  if (index === 0) return 'source'
  if (index === total - 1) return 'destination'

  return 'processor'
}

function getDistance(hop) {
  const distance = firstValue(
    hop,
    [
      'distance_from_previous_km',
      'distance_km',
      'distanceKm',
    ],
    null,
  )

  if (distance === null) return null

  const number = Number(distance)

  return Number.isFinite(number) ? number : null
}

function isViable(match) {
  const status = text(
    firstValue(match, ['status', 'decision', 'state'], 'viable'),
  ).toLowerCase()

  return ![
    'rejected',
    'infeasible',
    'invalid',
    'failed',
    'not_viable',
    'not viable',
  ].includes(status)
}

function createNodeLabel(name) {
  return name
}

export function buildGraphElements({
  wasteDna,
  discovery,
  impactPerRoute = [],
  decision,
}) {
  if (!wasteDna) {
    return {
      nodes: [],
      edges: [],
    }
  }

  const nodesById = new Map()
  const edges = []

  const rowCounts = {
    source: 0,
    processor: 0,
    destination: 0,
  }

  const recommendedKey =
    decision?.recommended_route_id ??
    decision?.recommendedRouteId ??
    decision?.recommended_route ??
    null

  function addNode({
    id,
    name,
    column,
    color,
    bold = false,
  }) {
    if (!id) return null

    if (nodesById.has(id)) {
      return nodesById.get(id)
    }

    const row = rowCounts[column]++

    const node = {
      id,
      type: 'default',
      data: {
        label: createNodeLabel(name),
      },
      position: {
        x: COLUMN_X[column],
        y: 70 + row * ROW_GAP,
      },
      style: nodeStyle(color, bold),
      draggable: true,
    }

    nodesById.set(id, node)

    return node
  }

  /*
   * ------------------------------------------------------------
   * SOURCE FACTORY
   * ------------------------------------------------------------
   */

  const sourceId = text(
    firstValue(
      wasteDna,
      [
        'source_factory_id',
        'sourceFactoryId',
        'factory_id',
        'factoryId',
      ],
      'source',
    ),
    'source',
  )

  const sourceName = text(
    firstValue(
      wasteDna,
      [
        'source_factory',
        'source_factory_name',
        'sourceFactory',
        'sourceFactoryName',
      ],
      'Source Factory',
    ),
    'Source Factory',
  )

  addNode({
    id: sourceId,
    name: sourceName,
    column: 'source',
    color: COLORS.source,
    bold: true,
  })

  /*
   * ------------------------------------------------------------
   * IMPACT LOOKUP
   * ------------------------------------------------------------
   */

  const impactByKey = new Map()

  for (const impact of impactPerRoute ?? []) {
    const key = text(
      firstValue(
        impact,
        [
          'route_key',
          'route_id',
          'routeId',
          'destination_factory_id',
        ],
        '',
      ),
    )

    if (key) {
      impactByKey.set(key, impact)
    }
  }

  /*
   * ------------------------------------------------------------
   * DIRECT MATCHES
   * ------------------------------------------------------------
   */

  const directMatches = normaliseDirectMatches(discovery)

  for (const match of directMatches) {
    const id = factoryId(match, `destination-${nodesById.size}`)
    const name = factoryName(match)

    const chosen =
      recommendedKey !== null &&
      String(recommendedKey) === String(id)

    const viable = isViable(match)

    const color = chosen
      ? COLORS.recommended
      : viable
        ? COLORS.viable
        : COLORS.rejected

    addNode({
      id,
      name,
      column: 'destination',
      color,
      bold: chosen,
    })

    const distance = firstValue(
      match,
      [
        'distance_km',
        'distanceKm',
        'distance',
      ],
      null,
    )

    const reasons =
      match?.reasons ??
      match?.rejection_reasons ??
      match?.rejectionReasons ??
      []

    const reason =
      Array.isArray(reasons) && reasons.length > 0
        ? reasons[0]
        : 'Rejected'

    edges.push({
      id: `${sourceId}->${id}`,
      source: sourceId,
      target: id,
      label: !viable
        ? text(reason)
        : distance !== null
          ? `${Math.round(Number(distance))} km`
          : 'DIRECT',
      animated: chosen,
      style: edgeStyle(
        color,
        chosen,
        !viable,
      ),
      labelStyle: {
        fill: '#9aa5b5',
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      labelBgStyle: {
        fill: '#12161d',
        color: '#12161d',
      },
    })
  }

  /*
   * ------------------------------------------------------------
   * MULTI-HOP ROUTES
   * ------------------------------------------------------------
   */

  const multiHopRoutes = normaliseMultiHopRoutes(discovery)

  for (const route of multiHopRoutes) {
    const routeKey = normaliseRouteKey(route)

    const chosen =
      recommendedKey !== null &&
      String(recommendedKey) === String(routeKey)

    const routeColor = chosen
      ? COLORS.recommended
      : COLORS.viable

    const hops = normaliseHops(route)

    if (hops.length === 0) {
      continue
    }

    let previousId = sourceId

    for (let index = 0; index < hops.length; index += 1) {
      const hop = hops[index]

      const role = getHopRole(
        hop,
        index,
        hops.length,
      )

      if (role === 'source') {
        continue
      }

      const id = factoryId(
        hop,
        `${routeKey || 'route'}-${index}`,
      )

      const name = factoryName(
        hop,
        `Factory ${index + 1}`,
      )

      const column =
        role === 'processor'
          ? 'processor'
          : 'destination'

      const color =
        role === 'processor'
          ? COLORS.processor
          : routeColor

      addNode({
        id,
        name,
        column,
        color,
        bold: chosen,
      })

      const distance = getDistance(hop)

      edges.push({
        id: `${previousId}->${id}::${routeKey || index}`,
        source: previousId,
        target: id,
        label:
          distance !== null
            ? `${Math.round(distance)} km`
            : undefined,
        animated: chosen,
        style: edgeStyle(
          color,
          chosen,
          false,
        ),
        labelStyle: {
          fill: '#9aa5b5',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
        },
        labelBgStyle: {
          fill: '#12161d',
          color: '#12161d',
        },
      })

      previousId = id
    }

    /*
     * Put ecosystem value on the final edge of the
     * recommended route when Impact data exists.
     */

    if (chosen && routeKey) {
      const impact = impactByKey.get(routeKey)

      if (impact) {
        const ecosystemValue =
          impact?.ecosystem_value?.value ??
          impact?.ecosystemValue?.value ??
          impact?.ecosystem_value ??
          impact?.ecosystemValue

        const value = Number(ecosystemValue)

        if (Number.isFinite(value)) {
          const lastEdge =
            edges[edges.length - 1]

          if (lastEdge) {
            lastEdge.label =
              `Rs.${Math.round(value).toLocaleString('en-IN')}`
          }
        }
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * FALLBACK ROUTE
   *
   * If the backend gives us a Decision route but Discovery's
   * route objects have a slightly different shape, don't leave
   * the graph completely empty.
   * ------------------------------------------------------------
   */

  if (
    nodesById.size === 1 &&
    recommendedKey
  ) {
    const routeParts = String(
      recommendedKey,
    )
      .split('→')
      .map((part) => part.trim())
      .filter(Boolean)

    if (routeParts.length > 1) {
      let previousId = sourceId

      for (
        let index = 0;
        index < routeParts.length;
        index += 1
      ) {
        const name = routeParts[index]

        if (
          index === 0 &&
          name.toLowerCase() === sourceName.toLowerCase()
        ) {
          continue
        }

        const id = `fallback-${index}-${name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`

        const role =
          index === routeParts.length - 1
            ? 'destination'
            : 'processor'

        const column =
          role === 'processor'
            ? 'processor'
            : 'destination'

        addNode({
          id,
          name,
          column,
          color: COLORS.recommended,
          bold: true,
        })

        edges.push({
          id: `${previousId}->${id}::fallback`,
          source: previousId,
          target: id,
          animated: true,
          style: edgeStyle(
            COLORS.recommended,
            true,
          ),
          labelStyle: {
            fill: '#9aa5b5',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
          },
          labelBgStyle: {
            fill: '#12161d',
          },
        })

        previousId = id
      }
    }
  }

  return {
    nodes: Array.from(nodesById.values()),
    edges,
  }
}