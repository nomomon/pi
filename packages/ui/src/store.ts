import { createStore, produce } from 'solid-js/store'
import type { ChatEntry, RpcSessionState, RpcSlashCommand } from './types'

export interface ToolExecutionState {
  toolCallId: string
  toolName: string
  args: any
  result?: any
  isError?: boolean
  isRunning: boolean
  partialResult?: any
}

export interface AppState {
  connected: boolean
  connecting: boolean
  messages: ChatEntry[]
  toolExecutions: Record<string, ToolExecutionState>
  streamingEntryId: string | null
  isStreaming: boolean
  isCompacting: boolean
  model: { id: string; provider: string; name?: string } | null
  thinkingLevel: string
  sessionId: string
  sessionName: string | null
  sessionFile: string | null
  inputHistory: string[]
  historyIndex: number
  view: 'chat' | 'models' | 'sessions'
  availableModels: any[]
  slashCommands: RpcSlashCommand[]
  notification: { text: string; kind: 'info' | 'warning' | 'error' } | null
  pendingResponses: Record<string, { resolve: (v: any) => void; reject: (e: any) => void }>
  totalTokens: number
}

export const [state, setState] = createStore<AppState>({
  connected: false,
  connecting: false,
  messages: [],
  toolExecutions: {},
  streamingEntryId: null,
  isStreaming: false,
  isCompacting: false,
  model: null,
  thinkingLevel: 'auto',
  sessionId: '',
  sessionName: null,
  sessionFile: null,
  inputHistory: [],
  historyIndex: -1,
  view: 'chat',
  availableModels: [],
  slashCommands: [],
  notification: null,
  pendingResponses: {},
  totalTokens: 0,
})

export function applySessionState(s: RpcSessionState) {
  setState({
    isStreaming: s.isStreaming,
    isCompacting: s.isCompacting,
    thinkingLevel: s.thinkingLevel,
    sessionId: s.sessionId,
    sessionName: s.sessionName ?? null,
    sessionFile: s.sessionFile ?? null,
    model: s.model ?? null,
  })
}

let notifTimer: ReturnType<typeof setTimeout> | null = null

export function showNotification(text: string, kind: 'info' | 'warning' | 'error' = 'info', ms = 3000) {
  if (notifTimer) clearTimeout(notifTimer)
  setState('notification', { text, kind })
  if (ms > 0) {
    notifTimer = setTimeout(() => setState('notification', null), ms)
  }
}

export function addMessage(entry: ChatEntry) {
  setState(
    produce((s) => {
      s.messages.push(entry)
    }),
  )
}

export function updateMessage(id: string, updater: (e: ChatEntry) => void) {
  setState(
    produce((s) => {
      const idx = s.messages.findIndex((m) => m.id === id)
      if (idx >= 0) updater(s.messages[idx])
    }),
  )
}

export function pushHistory(text: string) {
  setState(
    produce((s) => {
      if (text && s.inputHistory[0] !== text) {
        s.inputHistory.unshift(text)
        if (s.inputHistory.length > 500) s.inputHistory.pop()
      }
      s.historyIndex = -1
    }),
  )
}
