import { For, Show, Switch, Match } from 'solid-js'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Terminal, FilePlus, FileText, FilePen, Search, FolderOpen, Wrench, ClockFading } from 'lucide-solid'
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

function ToolIcon(props: { name: string }) {
  switch (props.name) {
    case 'bash': return <Terminal size={12} />
    case 'write': return <FilePlus size={12} />
    case 'read': return <FileText size={12} />
    case 'edit': return <FilePen size={12} />
    case 'grep': return <Search size={12} />
    case 'find': case 'ls': return <FolderOpen size={12} />
    default: return <Wrench size={12} />
  }
}

function toolDescription(name: string, args: any): string {
  switch (name) {
    case 'bash': return args?.command?.split('\n')[0]?.slice(0, 80) ?? 'bash'
    case 'write': return args?.file_path ?? 'write'
    case 'read': return args?.file_path ?? 'read'
    case 'edit': return args?.file_path ?? 'edit'
    case 'grep': return `grep ${args?.pattern ?? ''}`
    case 'find': return `find ${args?.pattern ?? args?.path ?? ''}`
    case 'ls': return `ls ${args?.path ?? '.'}`
    default: return name
  }
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
    <div class="step-group">
      <button class="step-group-header" onClick={props.onToggle}>
        <span class="step-group-chevron">
          <Show when={props.expanded} fallback={<ChevronRight size={12} />}>
            <ChevronDown size={12} />
          </Show>
        </span>
        <span class="step-group-summary">{summarize(props.entries)}</span>
      </button>
      <Show when={props.expanded}>
        <div class="timeline-body">
          <For each={props.entries}>
            {(entry) => (
              <Switch>
                <Match when={entry.type === 'assistant'}>
                  <ThinkingNode
                    entry={entry}
                    expanded={props.itemExpanded[entry.id] ?? false}
                    onToggle={() => props.onToggleItem(entry.id)}
                  />
                </Match>
                <Match when={entry.type === 'tool_execution'}>
                  <ToolNode
                    entry={entry}
                    expanded={props.itemExpanded[entry.id] ?? false}
                    onToggle={() => props.onToggleItem(entry.id)}
                  />
                </Match>
                <Match when={entry.type === 'bash'}>
                  <BashNode
                    entry={entry}
                    expanded={props.itemExpanded[entry.id] ?? false}
                    onToggle={() => props.onToggleItem(entry.id)}
                  />
                </Match>
                <Match when={entry.type === 'compaction'}>
                  <div class="timeline-node timeline-node-inline">
                    <span class="timeline-node-icon timeline-icon-dim">↻</span>
                    <span class="timeline-node-label">{entry.message ?? 'Context compacted'}</span>
                  </div>
                </Match>
                <Match when={entry.type === 'system'}>
                  <div class={`timeline-node timeline-node-inline${entry.message?.startsWith('Error') ? ' timeline-node-error' : ''}`}>
                    <span class="timeline-node-icon timeline-icon-dim">·</span>
                    <span class="timeline-node-label">{entry.message}</span>
                  </div>
                </Match>
              </Switch>
            )}
          </For>
          <div class="timeline-node timeline-node-done">
            <span class="timeline-node-icon timeline-icon-done">
              <CheckCircle2 size={11} />
            </span>
            <span class="timeline-node-label">Done</span>
          </div>
        </div>
      </Show>
    </div>
  )
}

function ThinkingNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
  const blocks = () => props.entry.thinkingBlocks ?? []

  return (
    <div class="timeline-node">
      <button class="timeline-node-header" onClick={props.onToggle}>
        <span class="timeline-node-icon timeline-icon-thinking">
          <ClockFading size={12} />
        </span>
        <span class="timeline-node-label">
          {blocks().length === 1 ? 'Thought process' : `${blocks().length} thinking steps`}
        </span>
        <span class="timeline-node-expand">
          <Show when={props.expanded} fallback={<ChevronRight size={11} />}>
            <ChevronDown size={11} />
          </Show>
        </span>
      </button>
      <Show when={props.expanded}>
        <div class="timeline-node-detail">
          <For each={blocks()}>
            {(block: ThinkingContent) => (
              <Show when={!block.redacted} fallback={<em class="timeline-detail-dim">Redacted</em>}>
                <pre class="timeline-detail-text">{block.thinking}</pre>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

function ToolNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
  const status = () => {
    if (props.entry.toolIsRunning) return 'running'
    if (props.entry.toolIsError) return 'error'
    return 'done'
  }

  const resultText = () => {
    const r = props.entry.toolResult ?? props.entry.toolPartialResult
    if (!r) return ''
    if (typeof r === 'string') return r
    if (Array.isArray(r)) return r.map((c: any) => c?.text ?? JSON.stringify(c)).join('\n')
    return JSON.stringify(r, null, 2)
  }

  return (
    <div class="timeline-node">
      <button class="timeline-node-header" onClick={props.onToggle}>
        <span class={`timeline-node-icon timeline-icon-${status()}`}>
          <Show when={props.entry.toolIsRunning}>
            <Loader2 size={12} class="spin" />
          </Show>
          <Show when={!props.entry.toolIsRunning && props.entry.toolIsError}>
            <XCircle size={12} />
          </Show>
          <Show when={!props.entry.toolIsRunning && !props.entry.toolIsError}>
            <ToolIcon name={props.entry.toolName ?? ''} />
          </Show>
        </span>
        <span class="timeline-node-label">
          {toolDescription(props.entry.toolName ?? '', props.entry.toolArgs)}
        </span>
        <span class="timeline-node-expand">
          <Show when={props.expanded} fallback={<ChevronRight size={11} />}>
            <ChevronDown size={11} />
          </Show>
        </span>
      </button>
      <Show when={props.expanded}>
        <div class="timeline-node-detail">
          <Show when={props.entry.toolArgs}>
            <div class="timeline-detail-section">
              <div class="timeline-detail-label">Input</div>
              <pre class="timeline-detail-code">{JSON.stringify(props.entry.toolArgs, null, 2)}</pre>
            </div>
          </Show>
          <Show when={resultText()}>
            <div class="timeline-detail-section">
              <div class="timeline-detail-label">{props.entry.toolIsError ? 'Error' : 'Output'}</div>
              <pre class={`timeline-detail-code${props.entry.toolIsError ? ' timeline-detail-error' : ''}`}>{resultText()}</pre>
            </div>
          </Show>
          <Show when={props.entry.toolIsRunning && !resultText()}>
            <div class="timeline-detail-dim">Running…</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function BashNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
  const hasOutput = () => !!props.entry.bashOutput

  return (
    <div class="timeline-node">
      <button
        class="timeline-node-header"
        onClick={hasOutput() ? props.onToggle : undefined}
        style={hasOutput() ? undefined : { cursor: 'default' }}
      >
        <span class="timeline-node-icon timeline-icon-dim">
          <Terminal size={12} />
        </span>
        <span class="timeline-node-label">
          <span class="timeline-bash-prompt">$</span>
          {props.entry.bashCommand}
          {props.entry.bashIsRunning && <span class="timeline-bash-spin"> …</span>}
          {!props.entry.bashIsRunning && (props.entry.bashExitCode ?? 0) !== 0 && (
            <span class="timeline-bash-exit"> exit {props.entry.bashExitCode}</span>
          )}
        </span>
        <Show when={hasOutput()}>
          <span class="timeline-node-expand">
            <Show when={props.expanded} fallback={<ChevronRight size={11} />}>
              <ChevronDown size={11} />
            </Show>
          </span>
        </Show>
      </button>
      <Show when={props.expanded && hasOutput()}>
        <div class="timeline-node-detail">
          <pre class="timeline-detail-code">{props.entry.bashOutput}</pre>
          <Show when={props.entry.bashTruncated}>
            <div class="timeline-detail-dim" style={{ 'font-style': 'italic', 'margin-top': '3px' }}>output truncated</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
