import type { ChatEntry } from '../../types'
import styles from './BashExecution.module.css'

export default function BashExecution(props: { entry: ChatEntry }) {
  return (
    <div class={styles.bashExecution}>
      <div class={styles.bashCommand}>
        <span class={styles.bashPrompt}>$</span>
        <span class={styles.bashCmdText}>{props.entry.bashCommand}</span>
        {props.entry.bashIsRunning && <span class={styles.bashSpinner}>…</span>}
        {!props.entry.bashIsRunning && props.entry.bashExitCode !== undefined && props.entry.bashExitCode !== 0 && (
          <span class={styles.bashExitCode}>exit {props.entry.bashExitCode}</span>
        )}
      </div>
      {props.entry.bashOutput && (
        <pre class={styles.bashOutput}>{props.entry.bashOutput}</pre>
      )}
      {props.entry.bashTruncated && (
        <div class={styles.bashTruncated}>output truncated</div>
      )}
    </div>
  )
}
