import { Show } from 'solid-js'
import { CheckCircle2, XCircle, Loader2, ChevronRight, ChevronDown, Terminal, FilePlus, FileText, FilePen, Search, FolderOpen, Wrench } from 'lucide-solid'
import type { ChatEntry } from '../types'

interface Props {
  entry: ChatEntry
  expanded: boolean
  onToggle: () => void
}

function ToolIcon(props: { name: string }) {
  switch (props.name) {
    case 'bash': return <Terminal size={13} />
    case 'write': return <FilePlus size={13} />
    case 'read': return <FileText size={13} />
    case 'edit': return <FilePen size={13} />
    case 'grep': return <Search size={13} />
    case 'find': case 'ls': return <FolderOpen size={13} />
    default: return <Wrench size={13} />
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

export default function ToolExecution(props: Props) {
  const statusClass = () => {
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
    <div class={`tool-execution tool-${statusClass()}`}>
      <button class="tool-header" onClick={props.onToggle}>
        <span class={`tool-status-icon ${statusClass()}`}>
          <Show when={props.entry.toolIsRunning}>
            <Loader2 size={13} class="spin" />
          </Show>
          <Show when={!props.entry.toolIsRunning && props.entry.toolIsError}>
            <XCircle size={13} />
          </Show>
          <Show when={!props.entry.toolIsRunning && !props.entry.toolIsError}>
            <CheckCircle2 size={13} />
          </Show>
        </span>
        <span class="tool-type-icon">
          <ToolIcon name={props.entry.toolName ?? ''} />
        </span>
        <span class="tool-name">
          {toolDescription(props.entry.toolName ?? '', props.entry.toolArgs)}
        </span>
        <span class="tool-expand-icon">
          <Show when={props.expanded} fallback={<ChevronRight size={13} />}>
            <ChevronDown size={13} />
          </Show>
        </span>
      </button>
      <Show when={props.expanded}>
        <div class="tool-body">
          <Show when={props.entry.toolArgs}>
            <div class="tool-section">
              <div class="tool-section-label">Input</div>
              <pre class="tool-args">{JSON.stringify(props.entry.toolArgs, null, 2)}</pre>
            </div>
          </Show>
          <Show when={resultText()}>
            <div class="tool-section">
              <div class="tool-section-label">{props.entry.toolIsError ? 'Error' : 'Output'}</div>
              <pre class={`tool-result ${props.entry.toolIsError ? 'tool-result-error' : ''}`}>{resultText()}</pre>
            </div>
          </Show>
          <Show when={props.entry.toolIsRunning && !resultText()}>
            <div class="tool-running">Running...</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
