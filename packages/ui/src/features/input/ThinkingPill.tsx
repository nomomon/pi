import { For, Show } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { state } from '@/core/store'
import styles from './ThinkingPill.module.css'

interface ThinkingLevel {
  value: string
  label: string
  isDefault?: boolean
}

interface Props {
  showMenu: Accessor<boolean>
  setShowMenu: Setter<boolean>
  thinkingDisplay: Accessor<string>
  isReasoningActive: Accessor<boolean>
  modelSupportsReasoning: Accessor<boolean>
  supportedThinkingLevels: Accessor<ThinkingLevel[]>
  onSelectLevel: (level: string) => void
}

export default function ThinkingPill(props: Props) {
  return (
    <Show when={props.modelSupportsReasoning()}>
      <>
        <Show when={props.showMenu()}>
          <div class={styles.inputThinkingDropdown}>
            <For each={props.supportedThinkingLevels()}>
              {(t) => (
                <div
                  class={`${styles.imdRow}${state.thinkingLevel === t.value ? ` ${styles.active}` : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); props.onSelectLevel(t.value) }}
                >
                  <div class={styles.imdRowInfo}>
                    <span class={styles.imdModelName}>{t.label}</span>
                  </div>
                  <Show when={t.isDefault}>
                    <span class={styles.imdDefaultChip}>Default</span>
                  </Show>
                  <Show when={state.thinkingLevel === t.value}>
                    <span class={styles.imdCheck}>✓</span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <button
          class={[
            styles.inputThinkingPill,
            props.showMenu() ? styles.open : '',
            props.isReasoningActive() ? styles.reasoning : '',
          ].filter(Boolean).join(' ')}
          onMouseDown={(e) => {
            e.preventDefault()
            if (props.showMenu()) {
              props.setShowMenu(false)
            } else {
              props.setShowMenu(true)
            }
          }}
          title="Set thinking level"
        >
          <span class={styles.pillThinkingLabel}>{props.thinkingDisplay()}</span>
        </button>
      </>
    </Show>
  )
}
