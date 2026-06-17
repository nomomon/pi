import { For, Show, createEffect, createMemo, createSignal, Switch, Match } from 'solid-js'
import { state } from '../store'
import type { ChatEntry } from '../types'
import AssistantMessage from './AssistantMessage'
import ToolExecution from './ToolExecution'
import ToolCallGroup from './ToolCallGroup'
import BashExecution from './BashExecution'

type GroupedEntry =
  | { kind: 'single'; entry: ChatEntry }
  | { kind: 'toolGroup'; entries: ChatEntry[]; key: string }

export default function ChatView() {
  let containerRef: HTMLDivElement | undefined
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})

  function toggle(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  createEffect(() => {
    const _ = state.messages.length
    const _s = state.isStreaming
    if (containerRef) containerRef.scrollTop = containerRef.scrollHeight
  })

  const grouped = createMemo((): GroupedEntry[] => {
    const result: GroupedEntry[] = []
    let group: ChatEntry[] = []

    for (const entry of state.messages) {
      if (entry.type === 'tool_execution') {
        group.push(entry)
      } else {
        if (group.length > 0) {
          result.push({ kind: 'toolGroup', entries: group, key: `group:${group[0].id}` })
          group = []
        }
        result.push({ kind: 'single', entry })
      }
    }

    if (group.length > 0) {
      result.push({ kind: 'toolGroup', entries: group, key: `group:${group[0].id}` })
    }

    return result
  })

  return (
    <div class="chat-view" ref={containerRef}>
      <For each={grouped()}>
        {(item) => (
          <Show
            when={item.kind === 'toolGroup'}
            fallback={<ChatEntryRenderer entry={(item as { kind: 'single'; entry: ChatEntry }).entry} onToggleTool={toggle} toolExpanded={expanded()} />}
          >
            <ToolCallGroup
              entries={(item as { kind: 'toolGroup'; entries: ChatEntry[]; key: string }).entries}
              expanded={expanded()[(item as { kind: 'toolGroup'; entries: ChatEntry[]; key: string }).key] ?? false}
              onToggle={() => toggle((item as { kind: 'toolGroup'; entries: ChatEntry[]; key: string }).key)}
              toolExpanded={expanded()}
              onToggleTool={toggle}
            />
          </Show>
        )}
      </For>
      <Show when={state.messages.length === 0 && state.connected}>
        <div class="empty-state">
          <div class="empty-title">pi coding agent</div>
          <div class="empty-hint">Type a message to start. Use /model to switch models, /new for a new session.</div>
        </div>
      </Show>
    </div>
  )
}

function ChatEntryRenderer(props: { entry: ChatEntry; toolExpanded: Record<string, boolean>; onToggleTool: (id: string) => void }) {
  const e = () => props.entry

  return (
    <Switch>
      <Match when={e().type === 'user'}>
        <div class="chat-entry user-entry">
          <span class="role-label">You</span>
          <div class="user-text">{e().text}</div>
        </div>
      </Match>
      <Match when={e().type === 'assistant'}>
        <div class="chat-entry assistant-entry">
          <span class="role-label">pi</span>
          <AssistantMessage entry={e()} />
        </div>
      </Match>
      <Match when={e().type === 'tool_execution'}>
        <ToolExecution
          entry={e()}
          expanded={props.toolExpanded[e().id] ?? false}
          onToggle={() => props.onToggleTool(e().id)}
        />
      </Match>
      <Match when={e().type === 'bash'}>
        <div class="chat-entry bash-entry">
          <BashExecution entry={e()} />
        </div>
      </Match>
      <Match when={e().type === 'compaction'}>
        <div class="chat-entry compaction-entry">
          <span class="compaction-icon">&#x27F3;</span> {e().message}
        </div>
      </Match>
      <Match when={e().type === 'system'}>
        <div class={`chat-entry system-entry ${e().message?.startsWith('Error') ? 'error' : ''}`}>
          {e().message}
        </div>
      </Match>
    </Switch>
  )
}
