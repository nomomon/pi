import { createSignal, onMount, For, Show } from 'solid-js'
import { state, showNotification } from '../../store'
import { sendCommand, reloadSession } from '../../ws'
import styles from './SessionSelector.module.css'

interface Props {
  onClose: () => void
}

interface SessionItem {
  path: string
  id: string
  name?: string
  cwd: string
  created: string
  modified: string
  messageCount: number
  firstMessage: string
}

export default function SessionSelector(props: Props) {
  const [sessions, setSessions] = createSignal<SessionItem[]>([])
  const [loading, setLoading] = createSignal(true)
  const [filter, setFilter] = createSignal('')

  onMount(async () => {
    try {
      const result = await sendCommand({ type: 'list_sessions' })
      const sorted = (result?.sessions ?? []).sort(
        (a: SessionItem, b: SessionItem) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
      )
      setSessions(sorted)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  })

  const filtered = () => {
    const q = filter().toLowerCase()
    return sessions().filter((s) =>
      !q ||
      (s.name ?? '').toLowerCase().includes(q) ||
      s.firstMessage.toLowerCase().includes(q) ||
      s.cwd.toLowerCase().includes(q)
    )
  }

  async function switchSession(sessionPath: string) {
    props.onClose()
    try {
      await sendCommand({ type: 'switch_session', sessionPath })
      await reloadSession()
      showNotification('Session switched', 'info')
    } catch {
      showNotification('Failed to switch session', 'error')
    }
  }

  async function newSession() {
    props.onClose()
    try {
      await sendCommand({ type: 'new_session' })
      await reloadSession()
      showNotification('New session started', 'info')
    } catch {
      showNotification('Failed to start new session', 'error')
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div class={styles.overlay} onClick={props.onClose}>
      <div class={styles.overlayPanel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.overlayHeader}>
          <span>Sessions</span>
          <button class={styles.overlayClose} onClick={props.onClose}>&#x2715;</button>
        </div>
        <input
          class={styles.overlaySearch}
          placeholder="Filter sessions..."
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
          autofocus
          onKeyDown={(e) => { if (e.key === 'Escape') props.onClose() }}
        />
        <div class={styles.overlayList}>
          <button class={`${styles.sessionItem} ${styles.newSessionBtn}`} onClick={newSession}>
            + New Session
          </button>
          <Show when={loading()}>
            <div class={styles.overlayLoading}>Loading sessions...</div>
          </Show>
          <Show when={!loading() && filtered().length === 0}>
            <div class={styles.overlayEmpty}>No sessions found</div>
          </Show>
          <For each={filtered()}>
            {(s) => (
              <button
                class={`${styles.sessionItem}${state.sessionFile === s.path ? ' ' + styles.active : ''}`}
                onClick={() => switchSession(s.path)}
              >
                <div class={styles.sessionItemHeader}>
                  <span class={styles.sessionItemName}>{s.name ?? s.id.slice(0, 8)}</span>
                  <span class={styles.sessionItemDate}>{formatDate(s.modified)}</span>
                </div>
                <Show when={s.firstMessage}>
                  <span class={styles.sessionItemPreview}>{s.firstMessage.slice(0, 80)}</span>
                </Show>
                <span class={styles.sessionItemMeta}>{s.messageCount} msgs · {s.cwd}</span>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
