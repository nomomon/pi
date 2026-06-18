import { createSignal, createMemo, createEffect, Show, onCleanup } from 'solid-js'
import { state, setState, pushHistory, showNotification } from '../../store'
import { send, sendCommand, sendBash, reloadSession } from '../../ws'
import type { RpcSlashCommand } from '../../types'
import SlashSuggestions from './SlashSuggestions'
import ModelPill from './ModelPill'
import ThinkingPill from './ThinkingPill'
import ContextIndicator from './ContextIndicator'
import styles from './InputArea.module.css'

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

  const [value, setValue] = createSignal('')
  const [isComposing, setIsComposing] = createSignal(false)
  const [selectedSuggestion, setSelectedSuggestion] = createSignal(-1)
  const [showModelMenu, setShowModelMenu] = createSignal(false)
  const [showThinkingMenu, setShowThinkingMenu] = createSignal(false)
  const [showContextMenu, setShowContextMenu] = createSignal(false)
  const [modelsLoading, setModelsLoading] = createSignal(false)
  const [modelSearch, setModelSearch] = createSignal('')

  // Close all menus on outside click
  createEffect(() => {
    const any = showModelMenu() || showThinkingMenu() || showContextMenu()
    if (any) {
      const handler = (e: MouseEvent) => {
        if (cardRef && !cardRef.contains(e.target as Node)) {
          setShowModelMenu(false)
          setShowThinkingMenu(false)
          setShowContextMenu(false)
        }
      }
      document.addEventListener('mousedown', handler)
      onCleanup(() => document.removeEventListener('mousedown', handler))
    }
  })

  // Pre-load models when connected
  createEffect(() => {
    if (state.connected && state.availableModels.length === 0) {
      sendCommand({ type: 'get_available_models' })
        .then((data: any) => setState('availableModels', data?.models ?? []))
        .catch(() => {})
    }
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

  const currentModelConfig = createMemo(() =>
    state.availableModels.find((m: any) => m.id === state.model?.id) ?? null
  )

  const supportedThinkingLevels = createMemo(() => {
    const m = currentModelConfig()
    if (!m) return THINKING_LEVELS
    if (!m.reasoning) return THINKING_LEVELS
    const map: Record<string, string | null> = m.thinkingLevelMap ?? {}
    return THINKING_LEVELS.filter(t => {
      if (t.value === 'auto' || t.value === 'none') return true
      return !(t.value in map && map[t.value] === null)
    })
  })

  const modelSupportsReasoning = createMemo(() => {
    const m = currentModelConfig()
    if (!m) return true
    return !!m.reasoning
  })

  const isReasoningActive = createMemo(() =>
    modelSupportsReasoning() && state.thinkingLevel !== 'none'
  )

  const contextFill = createMemo(() => {
    const used = state.inputTokens
    const max = currentModelConfig()?.contextWindow
    if (!max || used <= 0) return null
    return Math.min(used / max, 1)
  })

  const contextArcColor = createMemo(() => {
    const p = contextFill()
    if (p === null) return 'var(--border)'
    if (p >= 0.9) return 'var(--red)'
    if (p >= 0.7) return 'var(--yellow)'
    return 'var(--accent)'
  })

  const modelDisplayName = () => {
    if (!state.model) return 'No model'
    return state.model.name ?? state.model.id
  }

  const thinkingDisplay = () => {
    const t = state.thinkingLevel
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

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

  return (
    <div class={styles.inputArea}>
      <div class={styles.inputCard} ref={cardRef}>
        <Show when={suggestions().length > 0}>
          <SlashSuggestions
            suggestions={suggestions()}
            activeIndex={selectedSuggestion()}
            onSelect={applySuggestion}
            onHover={setSelectedSuggestion}
          />
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
          class={styles.inputTextarea}
          rows={1}
          disabled={!state.connected}
        />

        <div class={styles.inputToolbar}>
          <div class={styles.inputToolbarSpacer} />

          <ContextIndicator
            showMenu={showContextMenu}
            setShowMenu={(v) => {
              setShowModelMenu(false)
              setShowThinkingMenu(false)
              setShowContextMenu(v)
            }}
            contextFill={contextFill}
            contextArcColor={contextArcColor}
            inputTokens={state.inputTokens}
            outputTokens={state.outputTokens}
            currentModelConfig={currentModelConfig()}
          />

          <ModelPill
            showMenu={showModelMenu}
            setShowMenu={setShowModelMenu}
            modelDisplayName={modelDisplayName}
            onSelectModel={selectModel}
            onToggle={openModelMenu}
            filteredModels={filteredModels}
            modelsLoading={modelsLoading}
            modelSearch={modelSearch}
            setModelSearch={setModelSearch}
          />

          <ThinkingPill
            showMenu={showThinkingMenu}
            setShowMenu={(v) => {
              setShowModelMenu(false)
              setModelSearch('')
              setShowThinkingMenu(v)
            }}
            thinkingDisplay={thinkingDisplay}
            isReasoningActive={isReasoningActive}
            modelSupportsReasoning={modelSupportsReasoning}
            supportedThinkingLevels={supportedThinkingLevels}
            onSelectLevel={selectThinking}
          />

          <button
            class={`${styles.inputSendBtn}${state.isStreaming ? ` ${styles.aborting}` : ''}`}
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
