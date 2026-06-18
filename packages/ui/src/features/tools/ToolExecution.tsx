import { Show } from 'solid-js'
import { CheckCircle2, XCircle, Loader2, ChevronRight, ChevronDown, Terminal, FilePlus, FileText, FilePen, Search, FolderOpen, Wrench } from 'lucide-solid'
import type { ChatEntry } from '@/types'
import styles from './ToolExecution.module.css'

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

  const executionClass = () => {
    if (props.entry.toolIsRunning) return `${styles.toolExecution} ${styles.toolRunning}`
    if (props.entry.toolIsError) return `${styles.toolExecution} ${styles.toolError}`
    return `${styles.toolExecution} ${styles.toolDone}`
  }

  const statusIconClass = () => {
    if (props.entry.toolIsRunning) return `${styles.toolStatusIcon} ${styles.running}`
    if (props.entry.toolIsError) return `${styles.toolStatusIcon} ${styles.error}`
    return `${styles.toolStatusIcon} ${styles.done}`
  }

  return (
    <div class={executionClass()}>
      <button class={styles.toolHeader} onClick={props.onToggle}>
        <span class={statusIconClass()}>
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
        <span class={styles.toolTypeIcon}>
          <ToolIcon name={props.entry.toolName ?? ''} />
        </span>
        <span class={styles.toolName}>
          {toolDescription(props.entry.toolName ?? '', props.entry.toolArgs)}
        </span>
        <span class={styles.toolExpandIcon}>
          <Show when={props.expanded} fallback={<ChevronRight size={13} />}>
            <ChevronDown size={13} />
          </Show>
        </span>
      </button>
      <Show when={props.expanded}>
        <div class={styles.toolBody}>
          <Show when={props.entry.toolArgs}>
            <div class={styles.toolSection}>
              <div class={styles.toolSectionLabel}>Input</div>
              <pre class={styles.toolArgs}>{JSON.stringify(props.entry.toolArgs, null, 2)}</pre>
            </div>
          </Show>
          <Show when={resultText()}>
            <div class={styles.toolSection}>
              <div class={styles.toolSectionLabel}>{props.entry.toolIsError ? 'Error' : 'Output'}</div>
              <pre class={`${styles.toolResult}${props.entry.toolIsError ? ` ${styles.toolResultError}` : ''}`}>{resultText()}</pre>
            </div>
          </Show>
          <Show when={props.entry.toolIsRunning && !resultText()}>
            <div class={styles.toolRunning}>Running...</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
