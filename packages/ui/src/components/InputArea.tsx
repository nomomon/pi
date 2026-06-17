import { createSignal, createMemo, For, Show } from 'solid-js'
import { state, setState, pushHistory, showNotification } from '../store'
import { send, sendCommand, sendBash, reloadSession } from '../ws'
import type { RpcSlashCommand } from '../types'

const BUILTIN_COMMANDS: RpcSlashCommand[] = [
  { name: 'model', description: 'Switch model', source: 'builtin' },
  { name: 'session', description: 'Switch or browse sessions', source: 'builtin' },
  { name: 'new', description: 'Start a new session', source: 'builtin' },
  { name: 'compact', description: 'Compact conversation context', source: 'builtin' },
  { name: 'name', description: 'Set session name', source: 'builtin' },
  { name: 'thinking', description: 'Set thinking level (none/low/medium/high/auto)', source: 'builtin' },
  { name: 'export', description: 'Export session to HTML', source: 'builtin' },
]

export default function InputArea() {
  let textareaRef: HTMLTextAreaElement | undefined
  const [value, setValue] = createSignal('')
  const [isComposing, setIsComposing] = createSignal(false)
  const [selectedSuggestion, setSelectedSuggestion] = createSignal(-1)

  function autoResize() {
    if (!textareaRef) return
    textareaRef.style.height = 'auto'
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 300) + 'px'
  }

  // Slash suggestions: show when text starts with / and no space yet (still entering the command name)
  const suggestions = createMemo<RpcSlashCommand[]>(() => {
    const v = value()
    if (!v.startsWith('/')) return []
    const query = v.slice(1).toLowerCase()
    // Once the user types a space after the command, suggestions are done
    if (query.includes(' ')) return []
    const all = [...BUILTIN_COMMANDS, ...state.slashCommands]
    if (!query) return all
    return all.filter((c) => c.name.toLowerCase().startsWith(query))
  })

  function applySuggestion(cmd: RpcSlashCommand) {
    // For commands that take arguments, leave a trailing space
    const needsArgs = ['compact', 'name', 'thinking'].includes(cmd.name)
    setValue(`/${cmd.name}${needsArgs ? ' ' : ''}`)
    setSelectedSuggestion(-1)
    textareaRef?.focus()
    autoResize()
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
    setSelectedSuggestion(-1)
    if (textareaRef) textareaRef.style.height = 'auto'

    // Slash commands
    if (text.startsWith('/model')) { setState('view', 'models'); return }
    if (text.startsWith('/session')) { setState('view', 'sessions'); return }
    if (text === '/new') {
      await sendCommand({ type: 'new_session' })
      await reloadSession()
      showNotification('New session started', 'info')
      return
    }
    if (text.startsWith('/compact')) {
      const instructions = text.slice('/compact'.length).trim() || undefined
      send({ type: 'compact', customInstructions: instructions })
      return
    }

    if (text.startsWith('/name')) {
      const name = text.slice('/name'.length).trim()
      if (!name) {
        showNotification('Usage: /name <session name>', 'warning')
        return
      }
      await sendCommand({ type: 'set_session_name', name })
      setState('sessionName', name)
      showNotification(`Session named: ${name}`, 'info')
      return
    }

    if (text.startsWith('/thinking')) {
      const level = text.slice('/thinking'.length).trim()
      const valid = ['none', 'low', 'medium', 'high', 'auto']
      if (!valid.includes(level)) {
        showNotification(`Usage: /thinking <${valid.join('|')}>`, 'warning')
        return
      }
      await sendCommand({ type: 'set_thinking_level', level: level as any })
      setState('thinkingLevel', level)
      showNotification(`Thinking level: ${level}`, 'info')
      return
    }

    if (text === '/export') {
      try {
        const result = await sendCommand({ type: 'export_html' })
        showNotification(`Exported to: ${result?.path ?? 'unknown'}`, 'info', 5000)
      } catch (e: any) {
        showNotification(`Export failed: ${e.message}`, 'error')
      }
      return
    }

    // Bash
    if (text.startsWith('!')) {
      const excludeFromContext = text.startsWith('!!')
      const command = text.slice(excludeFromContext ? 2 : 1).trim()
      sendBash(command, excludeFromContext)
      return
    }

    // Normal prompt
    send({ type: 'prompt', message: text })
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isComposing()) return

    // Suggestion navigation
    const suggs = suggestions()
    if (suggs.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestion((i) => (i <= 0 ? suggs.length - 1 : i - 1))
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestion((i) => (i >= suggs.length - 1 ? 0 : i + 1))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && selectedSuggestion() >= 0)) {
        e.preventDefault()
        const idx = selectedSuggestion() >= 0 ? selectedSuggestion() : 0
        applySuggestion(suggs[idx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedSuggestion(-1)
        setValue('')
        return
      }
    }

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
      if (state.view !== 'chat') { setState('view', 'chat'); e.preventDefault() }
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
            if (textareaRef) textareaRef.selectionStart = textareaRef.selectionEnd = textareaRef.value.length
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
        setValue(idx < 0 ? '' : state.inputHistory[idx])
      }
      return
    }
  }

  return (
    <div class="input-area">
      <div class="input-wrapper">
        <Show when={suggestions().length > 0}>
          <div class="slash-suggestions">
            <For each={suggestions()}>
              {(cmd, i) => (
                <div
                  class={`slash-suggestion ${i() === selectedSuggestion() ? 'selected' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); applySuggestion(cmd) }}
                  onMouseEnter={() => setSelectedSuggestion(i())}
                >
                  <span class="suggestion-name">/{cmd.name}</span>
                  {cmd.description && <span class="suggestion-desc">{cmd.description}</span>}
                  {cmd.source !== 'builtin' && <span class={`suggestion-source source-${cmd.source}`}>{cmd.source}</span>}
                </div>
              )}
            </For>
          </div>
        </Show>
        <div class="input-row">
          <textarea
            ref={textareaRef}
            value={value()}
            placeholder={state.isStreaming ? 'Streaming… (Ctrl+C to abort)' : 'Message pi… (/ for commands, ! for bash)'}
            onInput={(e) => {
              setValue(e.currentTarget.value)
              setSelectedSuggestion(-1)
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
            onClick={() => state.isStreaming ? send({ type: 'abort' }) : handleSubmit()}
            disabled={!state.connected}
          >
            {state.isStreaming ? '■' : '▶'}
          </button>
        </div>
      </div>
    </div>
  )
}
