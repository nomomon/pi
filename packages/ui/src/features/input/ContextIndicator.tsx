import { Show } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import styles from './ContextIndicator.module.css'

interface Props {
  showMenu: Accessor<boolean>
  setShowMenu: Setter<boolean>
  contextFill: Accessor<number | null>
  contextArcColor: Accessor<string>
  inputTokens: number
  outputTokens: number
  currentModelConfig: any
}

export default function ContextIndicator(props: Props) {
  return (
    <div class={styles.ctxIndicatorWrap}>
      <Show when={props.showMenu()}>
        <div class={styles.ctxPopup}>
          <button
            class={styles.ctxPopupClose}
            onMouseDown={(e) => { e.preventDefault(); props.setShowMenu(false) }}
          >
            ✕
          </button>
          <div class={styles.ctxPopupBarWrap}>
            <div class={styles.ctxPopupBar}>
              <div
                class={styles.ctxPopupBarFill}
                style={{
                  width: `${Math.round((props.contextFill() ?? 0) * 100)}%`,
                  background: props.contextArcColor(),
                }}
              />
            </div>
            <span class={styles.ctxPopupPct}>
              {props.contextFill() !== null ? `${Math.round(props.contextFill()! * 100)}%` : '—'}
            </span>
          </div>
          <Show when={props.contextFill() !== null}>
            <div class={styles.ctxPopupTotal}>
              {props.inputTokens.toLocaleString()} / {(props.currentModelConfig?.contextWindow ?? 0).toLocaleString()} tokens
            </div>
          </Show>
          <div class={styles.ctxPopupRows}>
            <div class={styles.ctxPopupRow}>
              <span class={styles.ctxPopupDot} style={{ background: 'var(--accent)' }} />
              <span class={styles.ctxPopupLabel}>Input</span>
              <span class={styles.ctxPopupVal}>{props.inputTokens.toLocaleString()}</span>
            </div>
            <div class={styles.ctxPopupRow}>
              <span class={styles.ctxPopupDot} style={{ background: 'var(--text-dim)' }} />
              <span class={styles.ctxPopupLabel}>Output</span>
              <span class={styles.ctxPopupVal}>{props.outputTokens.toLocaleString()}</span>
            </div>
          </div>
          <Show when={props.currentModelConfig}>
            <div class={styles.ctxPopupFooter}>
              <span>{props.currentModelConfig.name ?? props.currentModelConfig.id}</span>
              <span>{((props.currentModelConfig.contextWindow ?? 0) / 1000).toFixed(0)}K ctx</span>
            </div>
          </Show>
        </div>
      </Show>
      <button
        class={`${styles.ctxIndicator}${props.showMenu() ? ` ${styles.open}` : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          props.setShowMenu(v => !v)
        }}
        title="Context window usage"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="7" stroke="var(--border)" stroke-width="2" />
          <Show when={props.contextFill() !== null}>
            <circle
              cx="9" cy="9" r="7"
              stroke={props.contextArcColor()}
              stroke-width="2"
              stroke-linecap="round"
              stroke-dasharray="43.98"
              stroke-dashoffset={43.98 * (1 - props.contextFill()!)}
              transform="rotate(-90 9 9)"
            />
          </Show>
        </svg>
      </button>
    </div>
  )
}
