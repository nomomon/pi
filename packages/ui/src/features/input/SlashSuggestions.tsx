import { For } from 'solid-js'
import type { RpcSlashCommand } from '@/core/types'
import styles from './SlashSuggestions.module.css'

interface Props {
  suggestions: RpcSlashCommand[]
  activeIndex: number
  onSelect: (cmd: RpcSlashCommand) => void
  onHover: (index: number) => void
}

export default function SlashSuggestions(props: Props) {
  return (
    <div class={styles.slashSuggestionsWrap}>
      <div class={styles.slashSuggestions}>
        <For each={props.suggestions}>
          {(cmd, i) => (
            <div
              class={`${styles.slashSuggestion}${i() === props.activeIndex ? ` ${styles.selected}` : ''}`}
              onMouseDown={(e) => { e.preventDefault(); props.onSelect(cmd) }}
              onMouseEnter={() => props.onHover(i())}
            >
              <span class={styles.suggestionName}>/{cmd.name}</span>
              {cmd.description && <span class={styles.suggestionDesc}>{cmd.description}</span>}
              {cmd.source !== 'builtin' && (
                <span class={`${styles.suggestionSource} ${styles[`source_${cmd.source}` as keyof typeof styles] ?? ''}`}>
                  {cmd.source}
                </span>
              )}
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
