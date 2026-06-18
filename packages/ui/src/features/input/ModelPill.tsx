import { For, Show } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { state } from '../../store'
import styles from './ModelPill.module.css'

interface Props {
  showMenu: Accessor<boolean>
  setShowMenu: Setter<boolean>
  modelDisplayName: Accessor<string>
  onSelectModel: (m: any) => void
  onToggle: () => void
  filteredModels: Accessor<any[]>
  modelsLoading: Accessor<boolean>
  modelSearch: Accessor<string>
  setModelSearch: Setter<string>
}

export default function ModelPill(props: Props) {
  let searchInputRef: HTMLInputElement | undefined

  // Focus search input when menu opens
  // This is done via a createEffect in the parent; searchInputRef exposed via callback
  // We handle it here with a local ref approach
  const focusSearch = () => setTimeout(() => searchInputRef?.focus(), 0)

  return (
    <>
      <Show when={props.showMenu()}>
        <div class={styles.inputModelDropdown}>
          <div class={styles.imdSearchWrap}>
            <input
              ref={searchInputRef}
              class={styles.imdSearch}
              type="text"
              placeholder="Search models…"
              value={props.modelSearch()}
              onInput={(e) => props.setModelSearch(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  props.setShowMenu(false)
                  props.setModelSearch('')
                }
                if (e.key === 'Enter') {
                  const first = props.filteredModels()[0]
                  if (first) props.onSelectModel(first)
                }
              }}
            />
          </div>
          <Show when={props.modelsLoading()}>
            <div class={styles.imdLoading}>Loading models…</div>
          </Show>
          <Show when={!props.modelsLoading()}>
            <Show when={props.filteredModels().length === 0}>
              <div class={styles.imdLoading}>No models match "{props.modelSearch()}"</div>
            </Show>
            <For each={props.filteredModels()}>
              {(m: any) => (
                <div
                  class={`${styles.imdRow}${state.model?.id === m.id ? ` ${styles.active}` : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); props.onSelectModel(m) }}
                >
                  <div class={styles.imdRowInfo}>
                    <span class={styles.imdModelName}>{m.name ?? m.id}</span>
                    <span class={styles.imdModelSub}>{m.provider}</span>
                  </div>
                  <Show when={state.model?.id === m.id}>
                    <span class={styles.imdCheck}>✓</span>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>

      <button
        class={`${styles.inputModelPill}${props.showMenu() ? ` ${styles.open}` : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          if (props.showMenu()) {
            props.setShowMenu(false)
            props.setModelSearch('')
          } else {
            props.onToggle()
            focusSearch()
          }
        }}
        title="Select model"
      >
        <span class={styles.pillModelName}>{props.modelDisplayName()}</span>
      </button>
    </>
  )
}
