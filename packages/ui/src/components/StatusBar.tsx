import { Show } from 'solid-js'
import { state } from '../store'

export default function StatusBar() {
  return (
    <Show when={state.isStreaming || state.isCompacting}>
      <div class="status-bar">
        <span class="status-spinner">&#x27F3;</span>
        <span class="status-text">
          {state.isCompacting ? 'Compacting...' : 'Streaming...'}
        </span>
      </div>
    </Show>
  )
}
