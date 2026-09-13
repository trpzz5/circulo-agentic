import { useEffect, useState } from 'react'
import { getFactories, getMemory } from '../services/api.js'
import './SystemStatusBar.css'

function StatusItem({
  label,
  value,
  state = 'neutral',
}) {
  return (
    <div className="system-status__item">
      <span className="system-status__label label-caps">
        {label}
      </span>

      <div className="system-status__value-row">
        <span
          className={`system-status__indicator system-status__indicator--${state}`}
        />

        <span className="system-status__value mono">
          {value}
        </span>
      </div>
    </div>
  )
}

export default function SystemStatusBar({
  phase = 'idle',
  isSimulated = false,
}) {
  const [factoryCount, setFactoryCount] = useState(null)
  const [memoryCount, setMemoryCount] = useState(null)
  const [registryStatus, setRegistryStatus] = useState('loading')

  useEffect(() => {
    let active = true

    async function loadSystemData() {
      try {
        const [factories, memory] = await Promise.all([
          getFactories(),
          getMemory(),
        ])

        if (!active) return

        setFactoryCount(
          Array.isArray(factories)
            ? factories.length
            : 0
        )

        setMemoryCount(
          Array.isArray(memory)
            ? memory.length
            : 0
        )

        setRegistryStatus('online')
      } catch (error) {
        if (!active) return

        console.error(
          'Failed to load command center system data:',
          error
        )

        setRegistryStatus('error')
      }
    }

    loadSystemData()

    return () => {
      active = false
    }
  }, [])

  const pipelineState =
    phase === 'running'
      ? 'RUNNING'
      : phase === 'complete'
        ? 'COMPLETE'
        : phase === 'failed'
          ? 'FAILED'
          : 'READY'

  const pipelineIndicator =
    phase === 'running'
      ? 'active'
      : phase === 'complete'
        ? 'success'
        : phase === 'failed'
          ? 'error'
          : 'neutral'

  const networkState =
    registryStatus === 'online'
      ? 'ONLINE'
      : registryStatus === 'error'
        ? 'ERROR'
        : 'SYNC'

  const networkIndicator =
    registryStatus === 'online'
      ? 'success'
      : registryStatus === 'error'
        ? 'error'
        : 'active'

  return (
    <section className="system-status">
      <div className="system-status__identity">
        <span className="system-status__pulse" />

        <div>
          <span className="system-status__eyebrow mono">
            SYSTEM STATUS
          </span>

          <span className="system-status__mode label-caps">
            {isSimulated
              ? 'SIMULATION CONTEXT'
              : 'LIVE OPERATIONS'}
          </span>
        </div>
      </div>

      <div className="system-status__items">
        <StatusItem
          label="Pipeline"
          value={pipelineState}
          state={pipelineIndicator}
        />

        <StatusItem
          label="Network"
          value={networkState}
          state={networkIndicator}
        />

        <StatusItem
          label="Factories"
          value={
            factoryCount === null
              ? '—'
              : factoryCount
          }
          state={
            factoryCount === null
              ? 'active'
              : 'success'
          }
        />

        <StatusItem
          label="Memory"
          value={
            memoryCount === null
              ? '—'
              : memoryCount
          }
          state={
            memoryCount === null
              ? 'active'
              : 'success'
          }
        />

        {isSimulated && (
          <StatusItem
            label="Mode"
            value="SIMULATION"
            state="active"
          />
        )}
      </div>
    </section>
  )
}