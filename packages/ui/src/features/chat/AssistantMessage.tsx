import { For, Show, createSignal } from 'solid-js'
import { ChevronDown, ChevronRight } from 'lucide-solid'
import { parse } from 'marked'
import type { ChatEntry, ThinkingContent } from '@/core/types'
import styles from './AssistantMessage.module.css'
import mdStyles from '@/css/markdown.module.css'

interface Props {
  entry: ChatEntry
  hideThinking?: boolean
}

export default function AssistantMessage(props: Props) {
  return (
    <div class={styles.assistantMessage}>
      <Show when={!props.hideThinking}>
        <For each={props.entry.thinkingBlocks ?? []}>
          {(block) => <ThinkingBlock block={block} isStreaming={props.entry.isPartial ?? false} />}
        </For>
      </Show>
      <For each={props.entry.textBlocks ?? []}>
        {(block) => <TextBlock text={block.text} />}
      </For>
      <Show when={(props.entry.usage?.totalTokens ?? 0) > 0 && !props.entry.isPartial}>
        <div class={styles.usageLine}>
          {props.entry.usage?.totalTokens?.toLocaleString()} tokens
          <Show when={props.entry.model}>
            <span class={styles.usageModel}> · {props.entry.model}</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function ThinkingBlock(props: { block: ThinkingContent; isStreaming: boolean }) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class={styles.thinkingBlock}>
      <button
        class={styles.thinkingHeader}
        onClick={() => setExpanded((v) => !v)}
      >
        <span class={styles.thinkingIcon}>
          <Show when={expanded()} fallback={<ChevronRight size={12} />}>
            <ChevronDown size={12} />
          </Show>
        </span>
        <span class={styles.thinkingLabel}>
          {props.block.redacted ? 'Redacted thinking' : props.isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
      </button>
      <Show when={expanded()}>
        <div class={styles.thinkingBody}>
          <Show when={!props.block.redacted} fallback={<em>Redacted</em>}>
            <pre class={styles.thinkingText}>{props.block.thinking}</pre>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function TextBlock(props: { text: string }) {
  const html = () => {
    try {
      return parse(props.text) as string
    } catch {
      return `<pre>${props.text}</pre>`
    }
  }
  return <div class={mdStyles.markdownBody} innerHTML={html()} />
}
