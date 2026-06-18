import { createEffect, createSignal, onCleanup } from 'solid-js'
import { send } from '@/core/ws'
import styles from './WidgetDisplay.module.css'

interface Props {
  title: string
  code: string
  isStreaming?: boolean
}

export default function WidgetDisplay(props: Props) {
  // Throttle DOM writes to one per animation frame while streaming.
  // When streaming ends, flush the final code immediately.
  const [displayCode, setDisplayCode] = createSignal(props.code)
  let rafId: number | undefined

  createEffect(() => {
    const next = props.code
    const streaming = props.isStreaming ?? false

    if (!streaming) {
      if (rafId !== undefined) { cancelAnimationFrame(rafId); rafId = undefined }
      setDisplayCode(next)
      return
    }

    if (rafId !== undefined) return // already a frame queued; it will read latest props.code
    rafId = requestAnimationFrame(() => {
      setDisplayCode(props.code)
      rafId = undefined
    })
  })

  onCleanup(() => { if (rafId !== undefined) cancelAnimationFrame(rafId) })

  const isSvg = () => displayCode().trimStart().startsWith('<svg')

  function handleDownload() {
    const ext = isSvg() ? 'svg' : 'html'
    const mime = isSvg() ? 'image/svg+xml' : 'text/html'
    const blob = new Blob([displayCode()], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.title || 'widget'}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function buildSrcdoc(htmlCode: string): string {
    // Inject sendPrompt before the widget HTML
    const injection = `<script>window.sendPrompt=function(t){window.parent.postMessage({type:'pi_sendPrompt',text:t},'*')};<\/script>`
    return injection + htmlCode
  }

  function onMessage(e: MessageEvent) {
    if (e.data?.type === 'pi_sendPrompt' && typeof e.data.text === 'string') {
      send({ type: 'prompt', message: e.data.text })
    }
  }

  window.addEventListener('message', onMessage)
  onCleanup(() => window.removeEventListener('message', onMessage))

  return (
    <div class={styles.widgetWrap}>
      <div class={styles.widgetHeader}>
        <span class={styles.widgetTitle}>{props.title || 'widget'}</span>
        <button class={styles.widgetDownload} onClick={handleDownload}>
          Download
        </button>
      </div>
      {isSvg() ? (
        <div class={styles.widgetSvg} innerHTML={displayCode()} />
      ) : (
        <iframe
          class={styles.widgetIframe}
          srcdoc={buildSrcdoc(displayCode())}
          sandbox="allow-scripts"
          title={props.title}
        />
      )}
    </div>
  )
}
