import { For, Show, createEffect, Switch, Match } from 'solid-js'
import { state } from '../store'
import type { ChatEntry } from '../types'
import AssistantMessage from './AssistantMessage'
import ToolExecution from './ToolExecution'

export default function ChatView() {
  let containerRef: HTMLDivElement | undefined

  createEffect(() => {
    // Depend on messages length + streaming to auto-scroll
    const _ = state.messages.length
    const _s = state.isStreaming
    // scroll to bottom
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight
    }
  })

  return (
    <div class="chat-view" ref={containerRef}>
      <For each={state.messages}>
        {(entry) => <ChatEntryRenderer entry={entry} />}
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

function ChatEntryRenderer(props: { entry: ChatEntry }) {
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
        <ToolExecution entry={e()} />
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
