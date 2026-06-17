import { For, Show } from 'solid-js'
import { ChevronDown, ChevronRight } from 'lucide-solid'
import ToolExecution from './ToolExecution'
import type { ChatEntry } from '../types'

function n(count: number, singular: string, plural: string): string {
  return count === 1 ? `a ${singular}` : `${count} ${plural}`
}

function summarize(entries: ChatEntry[]): string {
  let commands = 0, created = 0, viewed = 0, edited = 0
  for (const e of entries) {
    switch (e.toolName) {
      case 'write': created++; break
      case 'read': viewed++; break
      case 'edit': edited++; break
      default: commands++; break
    }
  }
  const parts: string[] = []
  if (commands > 0) parts.push(`Ran ${n(commands, 'command', 'commands')}`)
  if (created > 0) parts.push(`${parts.length ? 'created' : 'Created'} ${n(created, 'file', 'files')}`)
  if (viewed > 0) parts.push(`${parts.length ? 'viewed' : 'Viewed'} ${n(viewed, 'file', 'files')}`)
  if (edited > 0) parts.push(`${parts.length ? 'edited' : 'Edited'} ${n(edited, 'file', 'files')}`)
  return parts.join(', ') || 'Tool calls'
}

interface Props {
  entries: ChatEntry[]
  expanded: boolean
  onToggle: () => void
  toolExpanded: Record<string, boolean>
  onToggleTool: (id: string) => void
}

export default function ToolCallGroup(props: Props) {
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
              <ToolExecution
                entry={entry}
                expanded={props.toolExpanded[entry.id] ?? false}
                onToggle={() => props.onToggleTool(entry.id)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
