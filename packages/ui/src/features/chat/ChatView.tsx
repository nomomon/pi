import { For, Show, createEffect, createSignal, Switch, Match } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { state } from '@/core/store'
import type { ChatEntry } from '@/core/types'
import AssistantMessage from './AssistantMessage'
import StepGroup from '@/features/tools/ToolCallGroup'
import WidgetDisplay from '@/features/tools/WidgetDisplay'
import FilePresentation from '@/features/tools/FilePresentation'
import styles from './ChatView.module.css'

type GroupedEntry =
  | { id: string; kind: 'message'; entry: ChatEntry; hideThinking: boolean }
  | { id: string; kind: 'step'; entries: ChatEntry[] }

export default function ChatView() {
  let containerRef: HTMLDivElement | undefined
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  createEffect(() => {
    const _ = state.messages.length
    const _s = state.isStreaming
    if (containerRef) containerRef.scrollTop = containerRef.scrollHeight
  })

  // Store + reconcile keeps item references stable across recomputes so For
  // doesn't destroy/recreate components on every incoming message.
  const [grouped, setGrouped] = createStore<GroupedEntry[]>([])

  createEffect(() => {
    const result: GroupedEntry[] = []
    let step: ChatEntry[] = []

    const flushStep = () => {
      if (step.length > 0) {
        result.push({ id: `step:${step[0].id}`, kind: 'step', entries: [...step] })
        step = []
      }
    }

    for (const entry of state.messages) {
      if (entry.type === 'user') {
        flushStep()
        result.push({ id: `msg:${entry.id}`, kind: 'message', entry, hideThinking: false })
      } else if (entry.type === 'assistant') {
        const hasThinking = (entry.thinkingBlocks?.length ?? 0) > 0
        const hasText = (entry.textBlocks?.length ?? 0) > 0

        if (hasThinking) step.push(entry)

        if (hasText) {
          flushStep()
          result.push({ id: `msg:${entry.id}`, kind: 'message', entry, hideThinking: hasThinking })
        }
      } else if (entry.type === 'widget' || entry.type === 'files') {
        flushStep()
        result.push({ id: `msg:${entry.id}`, kind: 'message', entry, hideThinking: false })
      } else {
        // tool_execution, bash, compaction, system
        step.push(entry)
      }
    }

    flushStep()
    setGrouped(reconcile(result, { key: 'id', merge: true }))
  })

  return (
    <div class={styles.chatView} ref={containerRef}>
      <div class={styles.chatColumn}>
        <For each={grouped}>
          {(item) => (
            <Switch>
              <Match when={item.kind === 'step' && (item as Extract<GroupedEntry, { kind: 'step' }>)}>
                {(g) => (
                  <StepGroup
                    entries={g().entries}
                    expanded={expanded()[g().id] ?? false}
                    onToggle={() => toggle(g().id)}
                    itemExpanded={expanded()}
                    onToggleItem={toggle}
                  />
                )}
              </Match>
              <Match when={item.kind === 'message' && (item as Extract<GroupedEntry, { kind: 'message' }>)}>
                {(m) => <MessageRenderer entry={m().entry} hideThinking={m().hideThinking} />}
              </Match>
            </Switch>
          )}
        </For>
        <Show when={state.messages.length === 0 && state.connected}>
          <div class={styles.emptyState}>
            <div class={styles.emptyTitle}>pi coding agent</div>
            <div class={styles.emptyHint}>Type a message to start. Use /model to switch models, /new for a new session.</div>
          </div>
        </Show>
      </div>
    </div>
  )
}

function MessageRenderer(props: { entry: ChatEntry; hideThinking: boolean }) {
  const e = () => props.entry
  return (
    <Switch>
      <Match when={e().type === 'user'}>
        <div class={`${styles.chatEntry} ${styles.userEntry}`}>
          <span class={styles.roleLabel}>You</span>
          <div class={styles.userText}>{e().text}</div>
        </div>
      </Match>
      <Match when={e().type === 'assistant'}>
        <div class={`${styles.chatEntry} ${styles.assistantEntry}`}>
          <span class={styles.roleLabel}>pi</span>
          <AssistantMessage entry={e()} hideThinking={props.hideThinking} />
        </div>
      </Match>
      <Match when={e().type === 'widget'}>
        <div class={styles.chatEntry}>
          <WidgetDisplay title={e().widgetTitle ?? ''} code={e().widgetCode ?? ''} isStreaming={e().widgetIsStreaming} />
        </div>
      </Match>
      <Match when={e().type === 'files'}>
        <div class={styles.chatEntry}>
          <FilePresentation files={e().presentedFiles ?? []} />
        </div>
      </Match>
    </Switch>
  )
}
