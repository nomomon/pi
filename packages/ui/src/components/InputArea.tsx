import { createSignal } from 'solid-js'
import { state, setState, pushHistory, showNotification } from '../store'
import { send, sendCommand } from '../ws'

export default function InputArea() {
  let textareaRef: HTMLTextAreaElement | undefined
  const [value, setValue] = createSignal('')
  const [isComposing, setIsComposing] = createSignal(false)

  function autoResize() {
    if (!textareaRef) return
    textareaRef.style.height = 'auto'
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 300) + 'px'
  }

  async function handleSubmit() {
    const text = value().trim()
    if (!text) return
    if (!state.connected) {
      showNotification('Not connected', 'error')
      return
    }

    pushHistory(text)
    setValue('')
    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }

    // Handle slash commands
    if (text.startsWith('/model')) {
      setState('view', 'models')
      return
    }
    if (text.startsWith('/session')) {
      setState('view', 'sessions')
      return
    }
    if (text === '/new') {
      await sendCommand({ type: 'new_session' })
      showNotification('New session started', 'info')
      setState('messages', [])
      return
    }
    if (text.startsWith('/compact')) {
      const instructions = text.slice('/compact'.length).trim() || undefined
      send({ type: 'compact', customInstructions: instructions })
      return
    }
    if (text.startsWith('!')) {
      const command = text.slice(1).trim()
      send({ type: 'bash', command })
      return
    }

    // Normal prompt
    send({ type: 'prompt', message: text })
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isComposing()) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'c' && e.ctrlKey) {
      if (state.isStreaming) {
        e.preventDefault()
        send({ type: 'abort' })
        showNotification('Aborting...', 'warning', 1500)
      }
      return
    }

    if (e.key === 'Escape') {
      if (state.view !== 'chat') {
        setState('view', 'chat')
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const ta = textareaRef!
      const atStart = ta.selectionStart === 0 && ta.selectionEnd === 0
      if (atStart || value() === '') {
        e.preventDefault()
        const idx = state.historyIndex + 1
        if (idx < state.inputHistory.length) {
          setState('historyIndex', idx)
          setValue(state.inputHistory[idx])
          setTimeout(() => {
            if (textareaRef) {
              textareaRef.selectionStart = textareaRef.selectionEnd = textareaRef.value.length
            }
          }, 0)
        }
      }
      return
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      if (state.historyIndex >= 0) {
        e.preventDefault()
        const idx = state.historyIndex - 1
        setState('historyIndex', idx)
        if (idx < 0) {
          setValue('')
        } else {
          setValue(state.inputHistory[idx])
        }
      }
      return
    }
  }

  return (
    <div class="input-area">
      <textarea
        ref={textareaRef}
        value={value()}
        placeholder={state.isStreaming ? 'Streaming... (Ctrl+C to abort)' : 'Message pi... (/ for commands, ! for bash)'}
        onInput={(e) => {
          setValue(e.currentTarget.value)
          autoResize()
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        class="chat-input"
        rows={1}
        disabled={!state.connected}
      />
      <button
        class={`send-btn ${state.isStreaming ? 'abort-btn' : ''}`}
        onClick={() => {
          if (state.isStreaming) {
            send({ type: 'abort' })
          } else {
            handleSubmit()
          }
        }}
        disabled={!state.connected}
      >
        {state.isStreaming ? '■' : '▶'}
      </button>
    </div>
  )
}
