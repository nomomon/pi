import { createSignal, createEffect, Show } from 'solid-js'
import type { ChatEntry } from '../types'

interface Props {
  entry: ChatEntry
}

export default function ToolExecution(props: Props) {
  const [expanded, setExpanded] = createSignal(false)

  // Auto-expand on error
  createEffect(() => {
    if (props.entry.toolIsError) setExpanded(true)
  })

  const statusIcon = () => {
    if (props.entry.toolIsRunning) return '⟳'
    if (props.entry.toolIsError) return '✗'
    return '✓'
  }

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
      <button class="tool-header" onClick={() => setExpanded((v) => !v)}>
        <span class={`tool-status-icon ${statusClass()}`}>{statusIcon()}</span>
        <span class="tool-name">{props.entry.toolName}</span>
        <span class="tool-expand-icon">{expanded() ? '▾' : '▸'}</span>
      </button>
      <Show when={expanded()}>
        <div class="tool-body">
          <Show when={props.entry.toolArgs}>
            <div class="tool-section">
              <div class="tool-section-label">Args</div>
              <pre class="tool-args">{JSON.stringify(props.entry.toolArgs, null, 2)}</pre>
            </div>
          </Show>
          <Show when={resultText()}>
            <div class="tool-section">
              <div class="tool-section-label">{props.entry.toolIsError ? 'Error' : 'Result'}</div>
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
