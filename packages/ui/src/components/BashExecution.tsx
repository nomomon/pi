import type { ChatEntry } from '../types'

export default function BashExecution(props: { entry: ChatEntry }) {
  return (
    <div class="bash-execution">
      <div class="bash-command">
        <span class="bash-prompt">$</span>
        <span class="bash-cmd-text">{props.entry.bashCommand}</span>
        {props.entry.bashIsRunning && <span class="bash-spinner">…</span>}
        {!props.entry.bashIsRunning && props.entry.bashExitCode !== undefined && props.entry.bashExitCode !== 0 && (
          <span class="bash-exit-code">exit {props.entry.bashExitCode}</span>
        )}
      </div>
      {props.entry.bashOutput && (
        <pre class="bash-output">{props.entry.bashOutput}</pre>
      )}
      {props.entry.bashTruncated && (
        <div class="bash-truncated">output truncated</div>
      )}
    </div>
  )
}
