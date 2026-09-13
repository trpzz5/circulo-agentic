const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'http://127.0.0.1:8000/api'

async function handleResponse(response) {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`

    try {
      const data = await response.json()

      if (data?.detail) {
        message =
          typeof data.detail === 'string'
            ? data.detail
            : JSON.stringify(data.detail)
      }
    } catch {
      // Keep the default HTTP error message.
    }

    throw new Error(message)
  }

  return response.json()
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`)

  return handleResponse(response)
}

export async function uploadManifest(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${API_BASE}/upload-manifest`,
    {
      method: 'POST',
      body: formData,
    }
  )

  return handleResponse(response)
}

export async function startAnalysis({
  rawText,
  manifestId,
  maxHops = 2,
}) {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw_text: rawText || null,
      manifest_id: manifestId || null,
      max_hops: maxHops,
    }),
  })

  return handleResponse(response)
}

export async function getRunResult(runId) {
  const response = await fetch(
    `${API_BASE}/routes/${encodeURIComponent(runId)}`
  )

  return handleResponse(response)
}

export function subscribeToRun(
  runId,
  {
    onEvent,
    onDone,
    onError,
  }
) {
  const source = new EventSource(
    `${API_BASE}/stream/${encodeURIComponent(runId)}`
  )

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onEvent?.(data)

      if (
        data.agent === 'pipeline' &&
        (data.status === 'complete' ||
          data.status === 'failed')
      ) {
        onDone?.()
        source.close()
      }
    } catch (error) {
      console.error(
        'Failed to parse pipeline event:',
        error
      )
    }
  }

  source.onerror = () => {
    onError?.()
    source.close()
  }

  return () => {
    source.close()
  }
}

export async function getFactories() {
  const response = await fetch(
    `${API_BASE}/factories`
  )

  return handleResponse(response)
}

export async function getFactory(factoryId) {
  const response = await fetch(
    `${API_BASE}/factories/${encodeURIComponent(factoryId)}`
  )

  return handleResponse(response)
}

export async function getMemory() {
  const response = await fetch(
    `${API_BASE}/memory`
  )

  return handleResponse(response)
}

export async function simulateWhatIf({
  wasteDna,
  maxHops = 2,
}) {
  const response = await fetch(
    `${API_BASE}/simulate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        waste_dna: wasteDna,
        max_hops: maxHops,
      }),
    }
  )

  return handleResponse(response)
}