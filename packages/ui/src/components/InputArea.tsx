import { createSignal, createMemo, createEffect, For, Show, onCleanup } from 'solid-js'
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

const THINKING_LEVELS = [
  { value: 'auto', label: 'Auto', isDefault: true },
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export default function InputArea() {
  let textareaRef: HTMLTextAreaElement | undefined
  let cardRef: HTMLDivElement | undefined
  let searchInputRef: HTMLInputElement | undefined
  const [value, setValue] = createSignal('')
  const [isComposing, setIsComposing] = createSignal(false)
  const [selectedSuggestion, setSelectedSuggestion] = createSignal(-1)
  const [showModelMenu, setShowModelMenu] = createSignal(false)
  const [showThinkingMenu, setShowThinkingMenu] = createSignal(false)
  const [modelsLoading, setModelsLoading] = createSignal(false)
  const [modelSearch, setModelSearch] = createSignal('')

  createEffect(() => {
    const either = showModelMenu() || showThinkingMenu()
    if (either) {
      const handler = (e: MouseEvent) => {
        if (cardRef && !cardRef.contains(e.target as Node)) {
          setShowModelMenu(false)
          setShowThinkingMenu(false)
        }
      }
      document.addEventListener('mousedown', handler)
      onCleanup(() => document.removeEventListener('mousedown', handler))
    }
  })

  createEffect(() => {
    if (showModelMenu()) setTimeout(() => searchInputRef?.focus(), 0)
  })

  function autoResize() {
    if (!textareaRef) return
    textareaRef.style.height = 'auto'
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 384) + 'px'
  }

  const suggestions = createMemo<RpcSlashCommand[]>(() => {
    const v = value()
    if (!v.startsWith('/')) return []
    const query = v.slice(1).toLowerCase()
    if (query.includes(' ')) return []
    const all = [...BUILTIN_COMMANDS, ...state.slashCommands]
    if (!query) return all
    return all.filter((c) => c.name.toLowerCase().startsWith(query))
  })

  const filteredModels = createMemo(() => {
    const q = modelSearch().toLowerCase().trim()
    if (!q) return state.availableModels
    return state.availableModels.filter((m: any) =>
      (m.name ?? '').toLowerCase().includes(q) ||
      (m.id ?? '').toLowerCase().includes(q)
    )
  })

  function applySuggestion(cmd: RpcSlashCommand) {
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
    if (text.startsWith('!')) {
      const excludeFromContext = text.startsWith('!!')
      const command = text.slice(excludeFromContext ? 2 : 1).trim()
      sendBash(command, excludeFromContext)
      return
    }
    send({ type: 'prompt', message: text })
  }

  async function openModelMenu() {
    setShowModelMenu(true)
    setShowThinkingMenu(false)
    setModelSearch('')
    if (state.availableModels.length === 0) {
      setModelsLoading(true)
      try {
        const data = await sendCommand({ type: 'get_available_models' })
        setState('availableModels', data?.models ?? [])
      } catch (e) {
        showNotification('Failed to load models', 'error')
      } finally {
        setModelsLoading(false)
      }
    }
  }

  async function selectModel(m: any) {
    try {
      await sendCommand({ type: 'set_model', provider: m.provider, modelId: m.id })
      setState('model', { id: m.id, provider: m.provider, name: m.name })
      showNotification(`Model: ${m.name ?? m.id}`, 'info')
    } catch (e) {
      showNotification('Failed to set model', 'error')
    }
    setShowModelMenu(false)
    setShowThinkingMenu(false)
    setModelSearch('')
  }

  async function selectThinking(level: string) {
    try {
      await sendCommand({ type: 'set_thinking_level', level: level as any })
      setState('thinkingLevel', level)
    } catch (e) {
      showNotification('Failed to set thinking level', 'error')
    }
    setShowThinkingMenu(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isComposing()) return

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
      if (showModelMenu() || showThinkingMenu()) {
        setShowModelMenu(false)
        setShowThinkingMenu(false)
        e.preventDefault()
        return
      }
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

  const modelDisplayName = () => {
    if (!state.model) return 'No model'
    return state.model.name ?? state.model.id
  }

  const thinkingDisplay = () => {
    const t = state.thinkingLevel
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  return (
    <div class="input-area">
      <div class="input-card" ref={cardRef}>
        <Show when={suggestions().length > 0}>
          <div class="slash-suggestions-wrap">
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
          </div>
        </Show>

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
          class="input-textarea"
          rows={1}
          disabled={!state.connected}
        />

        <div class="input-toolbar">
          <Show when={showModelMenu()}>
            <div class="input-model-dropdown">
              <div class="imd-search-wrap">
                <input
                  ref={searchInputRef}
                  class="imd-search"
                  type="text"
                  placeholder="Search models…"
                  value={modelSearch()}
                  onInput={(e) => setModelSearch(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { e.preventDefault(); setShowModelMenu(false); setModelSearch('') }
                    if (e.key === 'Enter') { const first = filteredModels()[0]; if (first) selectModel(first) }
                  }}
                />
              </div>
              <Show when={modelsLoading()}>
                <div class="imd-loading">Loading models…</div>
              </Show>
              <Show when={!modelsLoading()}>
                <Show when={filteredModels().length === 0}>
                  <div class="imd-loading">No models match "{modelSearch()}"</div>
                </Show>
                <For each={filteredModels()}>
                  {(m: any) => (
                    <div
                      class={`imd-row ${state.model?.id === m.id ? 'active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); selectModel(m) }}
                    >
                      <div class="imd-row-info">
                        <span class="imd-model-name">{m.name ?? m.id}</span>
                        <span class="imd-model-sub">{m.provider}</span>
                      </div>
                      <Show when={state.model?.id === m.id}>
                        <span class="imd-check">✓</span>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>

          <Show when={showThinkingMenu()}>
            <div class="input-thinking-dropdown">
              <For each={THINKING_LEVELS}>
                {(t) => (
                  <div
                    class={`imd-row ${state.thinkingLevel === t.value ? 'active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); selectThinking(t.value) }}
                  >
                    <div class="imd-row-info">
                      <span class="imd-model-name">{t.label}</span>
                    </div>
                    <Show when={t.isDefault}>
                      <span class="imd-default-chip">Default</span>
                    </Show>
                    <Show when={state.thinkingLevel === t.value}>
                      <span class="imd-check">✓</span>
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="input-toolbar-spacer" />

          <button
            class={`input-model-pill ${showModelMenu() ? 'open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              if (showModelMenu()) {
                setShowModelMenu(false)
                setModelSearch('')
              } else {
                setShowThinkingMenu(false)
                openModelMenu()
              }
            }}
            title="Select model"
          >
            <span class="pill-model-name">{modelDisplayName()}</span>
            <span class="pill-chevron">▾</span>
          </button>

          <button
            class={`input-thinking-pill ${showThinkingMenu() ? 'open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              if (showThinkingMenu()) {
                setShowThinkingMenu(false)
              } else {
                setShowModelMenu(false)
                setModelSearch('')
                setShowThinkingMenu(true)
              }
            }}
            title="Set thinking level"
          >
            <span class="pill-thinking-label">{thinkingDisplay()}</span>
            <span class="pill-chevron">▾</span>
          </button>

          <button
            class={`input-send-btn ${state.isStreaming ? 'aborting' : ''}`}
            onClick={() => state.isStreaming ? send({ type: 'abort' }) : handleSubmit()}
            disabled={!state.connected}
            title={state.isStreaming ? 'Abort (Ctrl+C)' : 'Send'}
          >
            <Show when={state.isStreaming} fallback={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M7 2L3 6M7 2l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            }>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <rect width="10" height="10" rx="2"/>
              </svg>
            </Show>
          </button>
        </div>
      </div>
    </div>
  )
}
