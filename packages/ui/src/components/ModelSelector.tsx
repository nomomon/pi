import { createSignal, onMount, For, Show } from 'solid-js'
import { state, setState, showNotification } from '../store'
import { sendCommand } from '../ws'

interface Props {
  onClose: () => void
}

export default function ModelSelector(props: Props) {
  const [filter, setFilter] = createSignal('')
  const [loading, setLoading] = createSignal(true)

  onMount(async () => {
    try {
      const data = await sendCommand({ type: 'get_available_models' })
      setState('availableModels', data?.models ?? [])
    } catch (e) {
      showNotification('Failed to load models', 'error')
    } finally {
      setLoading(false)
    }
  })

  const filtered = () => {
    const q = filter().toLowerCase()
    return state.availableModels.filter((m: any) =>
      !q ||
      m.id?.toLowerCase().includes(q) ||
      m.provider?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q),
    )
  }

  async function selectModel(m: any) {
    try {
      await sendCommand({ type: 'set_model', provider: m.provider, modelId: m.id })
      setState('model', { id: m.id, provider: m.provider, name: m.name })
      showNotification(`Model set to ${m.id}`, 'info')
    } catch (e) {
      showNotification('Failed to set model', 'error')
    }
    props.onClose()
  }

  return (
    <div class="overlay" onClick={props.onClose}>
      <div class="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div class="overlay-header">
          <span>Select Model</span>
          <button class="overlay-close" onClick={props.onClose}>&#x2715;</button>
        </div>
        <input
          class="overlay-search"
          placeholder="Filter models..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          autofocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose()
          }}
        />
        <div class="overlay-list">
          <Show when={loading()}>
            <div class="overlay-loading">Loading models...</div>
          </Show>
          <Show when={!loading()}>
            <For each={filtered()}>
              {(m: any) => (
                <button
                  class={`model-item ${state.model?.id === m.id ? 'active' : ''}`}
                  onClick={() => selectModel(m)}
                >
                  <span class="model-provider">{m.provider}</span>
                  <span class="model-id">{m.id}</span>
                  <Show when={m.name}>
                    <span class="model-name">{m.name}</span>
                  </Show>
                </button>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  )
}
