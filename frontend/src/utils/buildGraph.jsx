const COLORS = {
  source: '#f5a524',
  processor: '#4a9df5',
  recommended: '#43d982',
  rejected: '#ef4a5c',
  alternative: '#65717d',
}

const COLUMN_X = {
  source: 90,
  processor: 430,
  destination: 770,
}

const GOLDEN_Y = 120
const ALTERNATIVE_START_Y = 350
const ALTERNATIVE_GAP = 150

function firstValue(
  source,
  keys,
  fallback = null
) {
  if (!source) {
    return fallback
  }

  for (const key of keys) {
    if (
      source[key] !== undefined &&
      source[key] !== null &&
      source[key] !== ''
    ) {
      return source[key]
    }
  }

  return fallback
}

function text(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return ''
  }

  return String(value).trim()
}

function normalize(value) {
  return text(value)
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function routeTokens(value) {
  const route = text(value)

  if (!route) {
    return []
  }

  return route
    .split(/\s*(?:→|->|>)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function getFactoryId(factory) {
  if (typeof factory === 'string') {
    return text(factory)
  }

  return text(
    firstValue(factory, [
      'factory_id',
      'factoryId',
      'id',
    ])
  )
}

function getFactoryName(factory) {
  if (typeof factory === 'string') {
    return text(factory)
  }

  return text(
    firstValue(factory, [
      'factory_name',
      'factoryName',
      'name',
      'label',
    ])
  )
}

function getRouteId(
  route,
  index
) {
  return text(
    firstValue(
      route,
      [
        'route_id',
        'routeId',
        'id',
      ],
      `route-${index + 1}`
    )
  )
}

function getRouteStatus(route) {
  const status = text(
    firstValue(
      route,
      [
        'status',
        'route_status',
        'routeStatus',
        'viability',
      ],
      'viable'
    )
  ).toLowerCase()

  if (
    status.includes('reject') ||
    status.includes('invalid') ||
    status.includes('fail') ||
    status === 'not_viable' ||
    status === 'not viable'
  ) {
    return 'rejected'
  }

  return 'viable'
}

function getDirectMatches(
  discovery
) {
  const value = firstValue(
    discovery,
    [
      'direct_matches',
      'directMatches',
      'direct',
      'matches',
    ],
    []
  )

  return Array.isArray(value)
    ? value
    : []
}

function getMultiHopRoutes(
  discovery
) {
  const value = firstValue(
    discovery,
    [
      'multi_hop_routes',
      'multiHopRoutes',
      'routes',
    ],
    []
  )

  return Array.isArray(value)
    ? value
    : []
}

function getRouteFactories(
  route
) {
  const hops = firstValue(
    route,
    [
      'hops',
      'nodes',
      'factories',
    ],
    []
  )

  if (
    Array.isArray(hops) &&
    hops.length > 0
  ) {
    return hops
      .map((hop) => ({
        id: getFactoryId(hop),
        name:
          getFactoryName(hop) ||
          getFactoryId(hop),
      }))
      .filter(
        (factory) =>
          factory.id ||
          factory.name
      )
  }

  const routeString =
    firstValue(
      route,
      [
        'route',
        'path',
        'path_string',
        'pathString',
        'route_string',
        'routeString',
      ]
    )

  return routeTokens(
    routeString
  ).map((part) => ({
    id: part,
    name: part,
  }))
}

function getRecommendedRoute(
  decision
) {
  return text(
    firstValue(
      decision,
      [
        'recommended_route_id',
        'recommendedRouteId',
        'recommended_route',
        'recommendedRoute',
      ]
    )
  )
}

function routeMatchesDecision(
  route,
  decision
) {
  const recommended =
    getRecommendedRoute(
      decision
    )

  if (!recommended) {
    return false
  }

  const routeId =
    getRouteId(route, 0)

  if (
    normalize(routeId) ===
    normalize(recommended)
  ) {
    return true
  }

  const routeString =
    text(
      firstValue(
        route,
        [
          'route',
          'path',
          'path_string',
          'pathString',
          'route_string',
          'routeString',
        ]
      )
    )

  if (
    normalize(routeString) ===
    normalize(recommended)
  ) {
    return true
  }

  const factories =
    getRouteFactories(
      route
    )

  if (
    factories.length === 0
  ) {
    return false
  }

  const routeIds =
    factories.map(
      (factory) =>
        normalize(
          factory.id
        )
    )

  const routeNames =
    factories.map(
      (factory) =>
        normalize(
          factory.name
        )
    )

  const recommendedParts =
    routeTokens(
      recommended
    ).map(normalize)

  if (
    recommendedParts.length !==
    factories.length
  ) {
    return false
  }

  return recommendedParts.every(
    (part, index) =>
      part === routeIds[index] ||
      part === routeNames[index]
  )
}

function createNode({
  id,
  name,
  factoryId,
  role,
  type,
  x,
  y,
  status,
}) {
  return {
    id,

    type: 'industrial',

    position: {
      x,
      y,
    },

    sourcePosition: 'right',

    targetPosition: 'left',

    draggable: false,

    selectable: false,

    connectable: false,

    data: {
      label: name,
      factoryId,
      role,
      type,
      status,
    },
  }
}

function createEdge({
  id,
  source,
  target,
  status,
  label,
  animated,
}) {
  const isRecommended =
    status === 'recommended'

  const isRejected =
    status === 'rejected'

  return {
    id,

    source,

    target,

    sourceHandle: 'right',

    targetHandle: 'left',

    type: 'smoothstep',

    animated:
      Boolean(animated),

    label:
      label || undefined,

    style: {
      stroke:
        isRecommended
          ? COLORS.recommended
          : isRejected
            ? COLORS.rejected
            : COLORS.alternative,

      strokeWidth:
        isRecommended
          ? 4
          : isRejected
            ? 2
            : 2,

      strokeDasharray:
        isRejected
          ? '7 7'
          : undefined,

      opacity:
        isRecommended
          ? 1
          : isRejected
            ? 0.5
            : 0.65,
    },

    markerEnd: {
      type: 'arrowclosed',

      color:
        isRecommended
          ? COLORS.recommended
          : isRejected
            ? COLORS.rejected
            : COLORS.alternative,

      width:
        isRecommended
          ? 18
          : 14,

      height:
        isRecommended
          ? 18
          : 14,
    },

    labelStyle: {
      fill:
        isRecommended
          ? COLORS.recommended
          : isRejected
            ? COLORS.rejected
            : '#8b97a2',

      fontSize: 9,

      fontWeight: 700,

      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    },

    labelBgStyle: {
      fill: '#0d1318',

      fillOpacity: 0.96,

      stroke:
        isRecommended
          ? 'rgba(67,217,130,.3)'
          : isRejected
            ? 'rgba(239,74,92,.25)'
            : 'rgba(125,135,148,.2)',

      strokeWidth: 1,
    },

    labelBgPadding: [
      6,
      4,
    ],
  }
}

function makeFactoryKey(
  factory
) {
  return normalize(
    factory.id ||
      factory.name
  )
}

function resolveFactory(
  factory,
  registry
) {
  const id =
    getFactoryId(factory)

  const name =
    getFactoryName(factory)

  const idKey =
    normalize(id)

  const nameKey =
    normalize(name)

  const found =
    registry.find(
      (candidate) =>
        normalize(
          candidate.id
        ) === idKey ||
        normalize(
          candidate.name
        ) === idKey ||
        normalize(
          candidate.id
        ) === nameKey ||
        normalize(
          candidate.name
        ) === nameKey
    )

  if (found) {
    return found
  }

  return {
    id: id || name,
    name: name || id,
  }
}

function buildFactoryRegistry(
  routes,
  wasteDna
) {
  const registry = []

  function add(factory) {
    const id =
      getFactoryId(factory)

    const name =
      getFactoryName(factory)

    if (!id && !name) {
      return
    }

    const exists =
      registry.some(
        (candidate) =>
          normalize(
            candidate.id
          ) ===
            normalize(
              id || name
            ) ||
          normalize(
            candidate.name
          ) ===
            normalize(
              name || id
            )
      )

    if (!exists) {
      registry.push({
        id: id || name,
        name: name || id,
      })
    }
  }

  const source =
    firstValue(
      wasteDna,
      [
        'source_factory',
        'sourceFactory',
        'factory_name',
        'factoryName',
      ]
    )

  if (source) {
    add({
      id: source,
      name: source,
    })
  }

  routes.forEach(
    (route) => {
      getRouteFactories(
        route
      ).forEach(add)
    }
  )

  return registry
}

function uniqueFactories(
  factories,
  registry
) {
  const seen = new Set()
  const result = []

  factories.forEach(
    (factory) => {
      const resolved =
        resolveFactory(
          factory,
          registry
        )

      const key =
        makeFactoryKey(
          resolved
        )

      if (!key) {
        return
      }

      if (seen.has(key)) {
        return
      }

      seen.add(key)
      result.push(resolved)
    }
  )

  return result
}

function addGoldenPath({
  factories,
  nodes,
  edges,
}) {
  const nodeIds = []

  factories.forEach(
    (factory, index) => {
      const isSource =
        index === 0

      const isDestination =
        index ===
        factories.length - 1

      const type =
        isSource
          ? 'source'
          : isDestination
            ? 'destination'
            : 'processor'

      const id =
        `golden-${makeFactoryKey(
          factory
        )}`

      const x =
        isSource
          ? COLUMN_X.source
          : isDestination
            ? COLUMN_X.destination
            : COLUMN_X.processor

      nodes.push(
        createNode({
          id,

          name:
            factory.name,

          factoryId:
            factory.id,

          role:
            isSource
              ? 'SOURCE'
              : isDestination
                ? 'DESTINATION'
                : 'PROCESSOR',

          type,

          x,

          y: GOLDEN_Y,

          status:
            'recommended',
        })
      )

      nodeIds.push(id)
    }
  )

  for (
    let index = 0;
    index <
    nodeIds.length - 1;
    index += 1
  ) {
    edges.push(
      createEdge({
        id:
          `golden-edge-${index}`,

        source:
          nodeIds[index],

        target:
          nodeIds[index + 1],

        status:
          'recommended',

        label:
          index === 0
            ? 'MATERIAL FLOW'
            : 'PROCESSED FLOW',

        animated: true,
      })
    )
  }
}

function addAlternativeRoute({
  factories,
  routeIndex,
  status,
  nodes,
  edges,
}) {
  const rowY =
    ALTERNATIVE_START_Y +
    routeIndex *
      ALTERNATIVE_GAP

  const nodeIds = []

  factories.forEach(
    (factory, index) => {
      const isSource =
        index === 0

      const isDestination =
        index ===
        factories.length - 1

      const type =
        isSource
          ? 'source'
          : isDestination
            ? 'destination'
            : 'processor'

      /*
       * Prefix with route index so
       * alternative routes never
       * collide with Golden Path
       * nodes.
       */
      const id =
        `alternative-${routeIndex}-${makeFactoryKey(
          factory
        )}`

      const x =
        isSource
          ? COLUMN_X.source
          : isDestination
            ? COLUMN_X.destination
            : COLUMN_X.processor

      nodes.push(
        createNode({
          id,

          name:
            factory.name,

          factoryId:
            factory.id,

          role:
            isSource
              ? 'SOURCE'
              : isDestination
                ? 'DESTINATION'
                : 'PROCESSOR',

          type,

          x,

          y: rowY,

          status,
        })
      )

      nodeIds.push(id)
    }
  )

  for (
    let index = 0;
    index <
    nodeIds.length - 1;
    index += 1
  ) {
    edges.push(
      createEdge({
        id:
          `alternative-edge-${routeIndex}-${index}`,

        source:
          nodeIds[index],

        target:
          nodeIds[index + 1],

        status,

        label:
          status === 'rejected'
            ? 'REJECTED'
            : undefined,

        animated: false,
      })
    )
  }
}

export function buildGraphElements({
  wasteDna,
  discovery,
  decision,
}) {
  if (
    !wasteDna ||
    !discovery
  ) {
    return {
      nodes: [],
      edges: [],
    }
  }

  const routes = [
    ...getDirectMatches(
      discovery
    ),
    ...getMultiHopRoutes(
      discovery
    ),
  ]

  const registry =
    buildFactoryRegistry(
      routes,
      wasteDna
    )

  const recommendedRoute =
    getRecommendedRoute(
      decision
    )

  /*
   * Find the exact route selected
   * by the Decision Agent.
   */
  let goldenFactories = []

  const matchingRoute =
    routes.find(
      (route) =>
        routeMatchesDecision(
          route,
          decision
        )
    )

  if (
    matchingRoute
  ) {
    goldenFactories =
      getRouteFactories(
        matchingRoute
      )
  }

  /*
   * If Discovery did not expose
   * the selected route as an object,
   * parse the Decision Agent route.
   */
  if (
    goldenFactories.length <
    2 &&
    recommendedRoute
  ) {
    goldenFactories =
      routeTokens(
        recommendedRoute
      ).map(
        (token) => ({
          id: token,
          name: token,
        })
      )
  }

  /*
   * Resolve route factories
   * against Discovery data.
   */
  goldenFactories =
    goldenFactories.map(
      (factory) =>
        resolveFactory(
          factory,
          registry
        )
    )

  /*
   * Make sure the actual source
   * factory is the first node.
   */
  const sourceName =
    text(
      firstValue(
        wasteDna,
        [
          'source_factory',
          'sourceFactory',
          'factory_name',
          'factoryName',
        ]
      )
    )

  if (
    sourceName &&
    goldenFactories.length > 0
  ) {
    const sourceFactory =
      resolveFactory(
        {
          id: sourceName,
          name: sourceName,
        },
        registry
      )

    const existingSourceIndex =
      goldenFactories.findIndex(
        (factory) =>
          normalize(
            factory.id
          ) ===
            normalize(
              sourceFactory.id
            ) ||
          normalize(
            factory.name
          ) ===
            normalize(
              sourceFactory.name
            )
      )

    if (
      existingSourceIndex >
      0
    ) {
      goldenFactories = [
        sourceFactory,
        ...goldenFactories.filter(
          (_, index) =>
            index !==
            existingSourceIndex
        ),
      ]
    } else if (
      existingSourceIndex ===
      -1
    ) {
      goldenFactories = [
        sourceFactory,
        ...goldenFactories,
      ]
    } else {
      goldenFactories[
        0
      ] = sourceFactory
    }
  }

  /*
   * Remove accidental duplicates.
   */
  goldenFactories =
    uniqueFactories(
      goldenFactories,
      registry
    )

  /*
   * Golden Path should have
   * at least two facilities.
   */
  const nodes = []
  const edges = []

  if (
    goldenFactories.length >=
    2
  ) {
    addGoldenPath({
      factories:
        goldenFactories,

      nodes,

      edges,
    })
  }

  /*
   * Render candidate routes
   * underneath the Golden Path.
   */
  let alternativeIndex = 0

  routes.forEach(
    (route) => {
      if (
        routeMatchesDecision(
          route,
          decision
        )
      ) {
        return
      }

      const factories =
        uniqueFactories(
          getRouteFactories(
            route
          ),
          registry
        )

      if (
        factories.length <
        2
      ) {
        return
      }

      const status =
        getRouteStatus(
          route
        )

      addAlternativeRoute({
        factories,

        routeIndex:
          alternativeIndex,

        status,

        nodes,

        edges,
      })

      alternativeIndex += 1
    }
  )

  return {
    nodes,
    edges,
  }
}