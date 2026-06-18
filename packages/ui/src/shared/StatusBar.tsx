import { Show } from 'solid-js'
import { state } from '@/core/store'
import styles from './StatusBar.module.css'

export default function StatusBar() {
  return (
    <Show when={state.isStreaming || state.isCompacting}>
      <div class={styles.statusBar}>
        <span class={styles.statusSpinner}>&#x27F3;</span>
        <span class={styles.statusText}>
          {state.isCompacting ? 'Compacting...' : 'Streaming...'}
        </span>
      </div>
    </Show>
  )
}
