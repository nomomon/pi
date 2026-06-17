import { For, Show } from 'solid-js'
import { ChevronDown, ChevronRight, ClockFading } from 'lucide-solid'
import ToolExecution from './ToolExecution'
import BashExecution from './BashExecution'
import type { ChatEntry, ThinkingContent } from '../types'

function n(count: number, singular: string, plural: string): string {
  return count === 1 ? `a ${singular}` : `${count} ${plural}`
}

function summarize(entries: ChatEntry[]): string {
  let thinking = 0, commands = 0, created = 0, viewed = 0, edited = 0, compactions = 0

  for (const e of entries) {
    if (e.type === 'assistant') {
      thinking += e.thinkingBlocks?.length ?? 0
    } else if (e.type === 'tool_execution') {
      switch (e.toolName) {
        case 'write': created++; break
        case 'read': viewed++; break
        case 'edit': edited++; break
        default: commands++; break
      }
    } else if (e.type === 'bash') {
      commands++
    } else if (e.type === 'compaction') {
      compactions++
    }
  }

  const parts: string[] = []
  if (thinking > 0) parts.push(`Thought ${n(thinking, 'time', 'times')}`)
  if (commands > 0) parts.push(`${parts.length ? 'ran' : 'Ran'} ${n(commands, 'command', 'commands')}`)
  if (created > 0) parts.push(`${parts.length ? 'created' : 'Created'} ${n(created, 'file', 'files')}`)
  if (viewed > 0) parts.push(`${parts.length ? 'viewed' : 'Viewed'} ${n(viewed, 'file', 'files')}`)
  if (edited > 0) parts.push(`${parts.length ? 'edited' : 'Edited'} ${n(edited, 'file', 'files')}`)
  if (compactions > 0) parts.push(`${parts.length ? 'compacted' : 'Compacted'} context`)
  return parts.join(', ') || 'Step'
}

interface Props {
  entries: ChatEntry[]
  expanded: boolean
  onToggle: () => void
  itemExpanded: Record<string, boolean>
  onToggleItem: (id: string) => void
}

export default function StepGroup(props: Props) {
  return (
    <div class="tool-call-group">
      <button class="tool-group-header" onClick={props.onToggle}>
        <span class="tool-group-chevron">
          <Show when={props.expanded} fallback={<ChevronRight size={13} />}>
            <ChevronDown size={13} />
          </Show>
        </span>
        <span class="tool-group-summary">{summarize(props.entries)}</span>
      </button>
      <Show when={props.expanded}>
        <div class="tool-group-body">
          <For each={props.entries}>
            {(entry) => (
              <Switch>
                <Match when={entry.type === 'assistant'}>
                  <ThinkingItem
                    entry={entry}
                    expanded={props.itemExpanded[entry.id] ?? false}
                    onToggle={() => props.onToggleItem(entry.id)}
                  />
                </Match>
                <Match when={entry.type === 'tool_execution'}>
                  <ToolExecution
                    entry={entry}
                    expanded={props.itemExpanded[entry.id] ?? false}
                    onToggle={() => props.onToggleItem(entry.id)}
                  />
                </Match>
                <Match when={entry.type === 'bash'}>
                  <div class="step-bash-item">
                    <BashExecution entry={entry} />
                  </div>
                </Match>
                <Match when={entry.type === 'compaction'}>
                  <div class="step-inline-item">
                    <span class="compaction-icon">&#x27F3;</span> {entry.message}
                  </div>
                </Match>
                <Match when={entry.type === 'system'}>
                  <div class={`step-inline-item ${entry.message?.startsWith('Error') ? 'error' : ''}`}>
                    {entry.message}
                  </div>
                </Match>
              </Switch>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function ThinkingItem(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
  const blocks = () => props.entry.thinkingBlocks ?? []

  return (
    <div class="thinking-group-item">
      <button class="tool-header" onClick={props.onToggle}>
        <span class="tool-status-icon done" style={{ color: 'var(--purple)' }}>
          <ClockFading size={13} />
        </span>
        <span class="tool-name" style={{ color: 'var(--purple)' }}>
          {blocks().length === 1 ? 'Thought process' : `${blocks().length} thinking blocks`}
        </span>
        <span class="tool-expand-icon">
          <Show when={props.expanded} fallback={<ChevronRight size={13} />}>
            <ChevronDown size={13} />
          </Show>
        </span>
      </button>
      <Show when={props.expanded}>
        <div class="tool-body">
          <For each={blocks()}>
            {(block: ThinkingContent) => (
              <div class="tool-section">
                <Show when={block.redacted} fallback={
                  <pre class="tool-result">{block.thinking}</pre>
                }>
                  <em style={{ color: 'var(--text-dim)' }}>Redacted</em>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
