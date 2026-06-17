import { For, Show, createSignal } from 'solid-js'
import { ChevronDown, ChevronRight } from 'lucide-solid'
import { parse } from 'marked'
import type { ChatEntry, ThinkingContent } from '../types'

interface Props {
  entry: ChatEntry
}

export default function AssistantMessage(props: Props) {
  return (
    <div class="assistant-message">
      <For each={props.entry.thinkingBlocks ?? []}>
        {(block) => <ThinkingBlock block={block} isStreaming={props.entry.isPartial ?? false} />}
      </For>
      <For each={props.entry.textBlocks ?? []}>
        {(block) => <TextBlock text={block.text} />}
      </For>
      <Show when={(props.entry.usage?.totalTokens ?? 0) > 0 && !props.entry.isPartial}>
        <div class="usage-line">
          {props.entry.usage?.totalTokens?.toLocaleString()} tokens
          <Show when={props.entry.model}>
            <span class="usage-model"> · {props.entry.model}</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function ThinkingBlock(props: { block: ThinkingContent; isStreaming: boolean }) {
  const [expanded, setExpanded] = createSignal(false)

  return (
    <div class="thinking-block">
      <button
        class="thinking-header"
        onClick={() => setExpanded((v) => !v)}
      >
        <span class="thinking-icon">
          <Show when={expanded()} fallback={<ChevronRight size={12} />}>
            <ChevronDown size={12} />
          </Show>
        </span>
        <span class="thinking-label">
          {props.block.redacted ? 'Redacted thinking' : props.isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
      </button>
      <Show when={expanded()}>
        <div class="thinking-body">
          <Show when={!props.block.redacted} fallback={<em>Redacted</em>}>
            <pre class="thinking-text">{props.block.thinking}</pre>
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
  return <div class="markdown-body" innerHTML={html()} />
}
