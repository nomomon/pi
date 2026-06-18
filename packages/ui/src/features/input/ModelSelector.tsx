import { createSignal, onMount, For, Show } from 'solid-js'
import { state, setState, showNotification } from '../../store'
import { sendCommand } from '../../ws'
import styles from './ModelSelector.module.css'

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
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.overlayPanel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.overlayHeader}>
          <span>Select Model</span>
          <button class={styles.overlayClose} onClick={props.onClose}>&#x2715;</button>
        </div>
        <input
          class={styles.overlaySearch}
          placeholder="Filter models..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          autofocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose()
          }}
        />
        <div class={styles.overlayList}>
          <Show when={loading()}>
            <div class={styles.overlayLoading}>Loading models...</div>
          </Show>
          <Show when={!loading()}>
            <For each={filtered()}>
              {(m: any) => (
                <button
                  class={`${styles.modelItem}${state.model?.id === m.id ? ` ${styles.active}` : ''}`}
                  onClick={() => selectModel(m)}
                >
                  <span class={styles.modelProvider}>{m.provider}</span>
                  <span class={styles.modelId}>{m.id}</span>
                  <Show when={m.name}>
                    <span class={styles.modelName}>{m.name}</span>
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
