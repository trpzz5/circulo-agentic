import { useMemo } from 'react'

import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import {
  buildGraphElements,
} from '../utils/buildGraph.jsx'

import './RouteGraph.css'

function formatNumber(
  value,
  digits = 0
) {
  const number =
    Number(value)

  if (
    !Number.isFinite(number)
  ) {
    return '—'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:
        digits,
    }
  ).format(number)
}

function splitRoute(
  value
) {
  if (!value) {
    return []
  }

  return String(value)
    .split(
      /\s*(?:→|->|>)\s*/
    )
    .map(
      (part) =>
        part.trim()
    )
    .filter(Boolean)
}

function getRecommendedRoute(
  decision
) {
  return (
    decision?.recommended_route_id ??
    decision?.recommendedRouteId ??
    decision?.recommended_route ??
    decision?.recommendedRoute ??
    null
  )
}

function getMetric(
  source,
  keys
) {
  if (!source) {
    return null
  }

  for (const key of keys) {
    if (
      source[key] !==
        undefined &&
      source[key] !== null
    ) {
      return source[key]
    }
  }

  return null
}

/* =========================================================
   INDUSTRIAL NODE
   ========================================================= */

function IndustrialNode({
  data,
}) {
  const type =
    data?.type ||
    'processor'

  const role =
    data?.role ||
    'PROCESSOR'

  const name =
    data?.label ||
    'Unknown facility'

  const factoryId =
    data?.factoryId || ''

  return (
    <div
      className={`industrial-node industrial-node--${type}`}
    >
      <Handle
        id="left"
        type="target"
        position={
          Position.Left
        }
        className="industrial-node__handle industrial-node__handle--left"
      />

      <div className="industrial-node__top">
        <span className="industrial-node__role">
          {role}
        </span>

        <span className="industrial-node__signal" />
      </div>

      <div className="industrial-node__name">
        {name}
      </div>

      {factoryId &&
        factoryId !== name && (
          <div className="industrial-node__id">
            {factoryId}
          </div>
        )}

      <Handle
        id="right"
        type="source"
        position={
          Position.Right
        }
        className="industrial-node__handle industrial-node__handle--right"
      />
    </div>
  )
}

const nodeTypes = {
  industrial:
    IndustrialNode,
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function RouteGraph({
  wasteDna,
  discovery,
  impactPerRoute = [],
  decision,
}) {
  const {
    nodes,
    edges,
  } = useMemo(
    () =>
      buildGraphElements({
        wasteDna,
        discovery,
        decision,
      }),
    [
      wasteDna,
      discovery,
      decision,
    ]
  )

  const recommendedRoute =
    getRecommendedRoute(
      decision
    )

  const routeParts =
    useMemo(
      () =>
        splitRoute(
          recommendedRoute
        ),
      [recommendedRoute]
    )

  const hopCount =
    routeParts.length >
    1
      ? routeParts.length - 1
      : 0

  const totalCost =
    getMetric(
      decision,
      [
        'total_cost',
        'total_cost_inr',
        'totalCost',
        'estimated_cost',
        'estimatedCost',
      ]
    )

  const co2Saved =
    getMetric(
      decision,
      [
        'co2_saved_kg',
        'co2_savings_kg',
        'co2SavedKg',
        'carbon_saved_kg',
        'carbon_savings_kg',
      ]
    )

  if (
    !wasteDna ||
    !discovery
  ) {
    return (
      <div className="route-graph panel route-graph--empty">
        <div className="route-graph__empty-header">
          <div>
            <span className="label-caps">
              Industrial Network
            </span>

            <h2 className="route-graph__empty-title">
              Route command view
            </h2>
          </div>

          <span className="mono">
            NETWORK STANDBY
          </span>
        </div>

        <div className="route-graph__empty-body">
          <span className="label-caps">
            Awaiting analysis
          </span>

          <p>
            Run an analysis to
            map the industrial
            network.
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="route-graph panel">
      {/* HEADER */}

      <header className="route-graph__header">
        <div className="route-graph__title-block">
          <div className="route-graph__title-line">
            <span className="label-caps">
              Industrial Network
            </span>

            <span className="route-graph__status">
              <span className="route-graph__status-dot" />
              ROUTE ACTIVE
            </span>
          </div>

          <h2 className="route-graph__heading">
            Golden Path
          </h2>

          <p className="route-graph__subheading">
            Agent-selected material
            flow across the industrial
            network.
          </p>
        </div>

        <div className="route-graph__header-meta">
          <div className="route-graph__meta-stat">
            <span className="label-caps">
              Hops
            </span>

            <strong className="mono">
              {hopCount
                ? String(
                    hopCount
                  ).padStart(
                    2,
                    '0'
                  )
                : '—'}
            </strong>
          </div>

          <div className="route-graph__meta-stat">
            <span className="label-caps">
              Candidates
            </span>

            <strong className="mono">
              {String(
                impactPerRoute.length ||
                  0
              ).padStart(
                2,
                '0'
              )}
            </strong>
          </div>
        </div>
      </header>

      {/* GOLDEN PATH COMMAND */}

      {recommendedRoute && (
        <section className="route-graph__command">
          <div className="route-graph__command-header">
            <div>
              <span className="label-caps">
                Recommended Route
              </span>

              <span className="route-graph__command-state">
                <span className="route-graph__command-state-dot" />
                SELECTED BY DECISION AGENT
              </span>
            </div>

            <span className="mono route-graph__command-id">
              GOLDEN PATH
            </span>
          </div>

          <div className="route-graph__route-chain">
            {routeParts.map(
              (
                part,
                index
              ) => (
                <div
                  className="route-graph__route-step"
                  key={`${part}-${index}`}
                >
                  <span className="route-graph__route-index mono">
                    {String(
                      index + 1
                    ).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <span className="route-graph__route-dot" />

                  <div className="route-graph__route-copy">
                    <span className="label-caps">
                      {index ===
                      0
                        ? 'SOURCE'
                        : index ===
                            routeParts.length -
                              1
                          ? 'DESTINATION'
                          : `PROCESSOR ${index}`}
                    </span>

                    <strong>
                      {part}
                    </strong>
                  </div>

                  {index <
                    routeParts.length -
                      1 && (
                    <span className="route-graph__route-arrow">
                      →
                    </span>
                  )}
                </div>
              )
            )}
          </div>

          {(totalCost !== null ||
            co2Saved !== null) && (
            <div className="route-graph__command-metrics">
              {totalCost !== null && (
                <div className="route-graph__command-metric">
                  <span className="label-caps">
                    Estimated Route Cost
                  </span>

                  <strong className="mono">
                    ₹
                    {formatNumber(
                      totalCost,
                      2
                    )}
                  </strong>
                </div>
              )}

              {co2Saved !== null && (
                <div className="route-graph__command-metric">
                  <span className="label-caps">
                    CO₂ Savings
                  </span>

                  <strong className="mono">
                    {formatNumber(
                      co2Saved,
                      2
                    )}{' '}
                    kg
                  </strong>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TOPOLOGY HEADER */}

      <div className="route-graph__canvas-header">
        <span className="label-caps">
          Network Topology
        </span>

        <div className="route-graph__legend">
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
        </div>
      </div>

      {/* GRAPH */}

      <div className="route-graph__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.18,
            minZoom: 0.5,
            maxZoom: 1.25,
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          proOptions={{
            hideAttribution: true,
          }}
        >
          <Background
            color="#1d262d"
            gap={28}
            size={1}
          />

          <Controls
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* FOOTER */}

      <footer className="route-graph__footer">
        <div className="route-graph__footer-status">
          <span className="route-graph__footer-dot" />

          <span className="mono">
            {edges.length > 0
              ? 'GOLDEN PATH VISUALIZED'
              : 'NETWORK MAPPED'}
          </span>
        </div>

        <span className="label-caps">
          DECISION OUTPUT → NETWORK
          VISUALIZATION
        </span>
      </footer>
    </section>
  )
}