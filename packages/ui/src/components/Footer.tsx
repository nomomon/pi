import { Show, createSignal } from 'solid-js'
import { state, showNotification } from '../store'
import { sendCommand } from '../ws'

export default function Footer() {
  const [editingName, setEditingName] = createSignal(false)
  const [nameInput, setNameInput] = createSignal('')

  function startRename() {
    setNameInput(state.sessionName ?? '')
    setEditingName(true)
  }

  async function commitRename() {
    const name = nameInput().trim()
    if (name) {
      await sendCommand({ type: 'set_session_name', name })
      showNotification(`Session renamed to "${name}"`, 'info')
    }
    setEditingName(false)
  }

  return (
    <div class="footer">
      <Show when={state.model}>
        {(m) => (
          <span class="footer-model">{m().provider}/{m().id}</span>
        )}
      </Show>
      <span class="footer-thinking">think:{state.thinkingLevel}</span>
      <Show when={state.totalTokens > 0}>
        <span class="footer-tokens">{state.totalTokens.toLocaleString()} tok</span>
      </Show>
      <Show
        when={editingName()}
        fallback={
          <span class="footer-session" onClick={startRename} title="Click to rename session">
            {state.sessionName ?? state.sessionId?.slice(0, 8) ?? '—'}
          </span>
        }
      >
        <input
          class="footer-rename-input"
          value={nameInput()}
          onInput={(e) => setNameInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditingName(false)
          }}
          onBlur={commitRename}
          autofocus
        />
      </Show>
    </div>
  )
}
