import { onCleanup } from 'solid-js'
import { send } from '@/core/ws'
import styles from './WidgetDisplay.module.css'

interface Props {
  title: string
  code: string
}

export default function WidgetDisplay(props: Props) {
  const isSvg = () => props.code.trimStart().startsWith('<svg')

  function handleDownload() {
    const ext = isSvg() ? 'svg' : 'html'
    const mime = isSvg() ? 'image/svg+xml' : 'text/html'
    const blob = new Blob([props.code], { type: mime })
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
        <div class={styles.widgetSvg} innerHTML={props.code} />
      ) : (
        <iframe
          class={styles.widgetIframe}
          srcdoc={buildSrcdoc(props.code)}
          sandbox="allow-scripts"
          title={props.title}
        />
      )}
    </div>
  )
}
