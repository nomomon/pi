import { For, Show, createEffect, createMemo, createSignal, Switch, Match } from 'solid-js'
import { state } from '../store'
import type { ChatEntry } from '../types'
import AssistantMessage from './AssistantMessage'
import StepGroup from './ToolCallGroup'

type GroupedEntry =
  | { kind: 'message'; entry: ChatEntry; hideThinking: boolean }
  | { kind: 'step'; entries: ChatEntry[]; key: string }

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
    let step: ChatEntry[] = []

    const flushStep = () => {
      if (step.length > 0) {
        result.push({ kind: 'step', entries: step, key: `step:${step[0].id}` })
        step = []
      }
    }

    for (const entry of state.messages) {
      if (entry.type === 'user') {
        flushStep()
        result.push({ kind: 'message', entry, hideThinking: false })
      } else if (entry.type === 'assistant') {
        const hasThinking = (entry.thinkingBlocks?.length ?? 0) > 0
        const hasText = (entry.textBlocks?.length ?? 0) > 0

        if (hasThinking) step.push(entry)

        if (hasText) {
          flushStep()
          result.push({ kind: 'message', entry, hideThinking: hasThinking })
        }
      } else {
        // tool_execution, bash, compaction, system
        step.push(entry)
      }
    }

    flushStep()
    return result
  })

  return (
    <div class="chat-view" ref={containerRef}>
      <For each={grouped()}>
        {(item) => (
          <Show
            when={item.kind === 'step'}
            fallback={() => {
              const m = item as { kind: 'message'; entry: ChatEntry; hideThinking: boolean }
              return <MessageRenderer entry={m.entry} hideThinking={m.hideThinking} />
            }}
          >
            {() => {
              const g = item as { kind: 'step'; entries: ChatEntry[]; key: string }
              return (
                <StepGroup
                  entries={g.entries}
                  expanded={expanded()[g.key] ?? false}
                  onToggle={() => toggle(g.key)}
                  itemExpanded={expanded()}
                  onToggleItem={toggle}
                />
              )
            }}
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

function MessageRenderer(props: { entry: ChatEntry; hideThinking: boolean }) {
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
          <AssistantMessage entry={e()} hideThinking={props.hideThinking} />
        </div>
      </Match>
    </Switch>
  )
}
