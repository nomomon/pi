import { For } from 'solid-js'
import styles from './FilePresentation.module.css'

interface FileItem {
  name: string
  path: string
  content_base64: string
  mime_type: string
  size: number
}

interface Props {
  files: FileItem[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function downloadFile(file: FileItem) {
  const bytes = Uint8Array.from(atob(file.content_base64), (c) => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: file.mime_type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

export default function FilePresentation(props: Props) {
  return (
    <div class={styles.filesWrap}>
      <For each={props.files}>
        {(file) => (
          <div class={styles.fileCard}>
            <div class={styles.fileInfo}>
              <span class={styles.fileName}>{file.name}</span>
              <span class={styles.fileMeta}>
                {formatSize(file.size)} · {file.mime_type}
              </span>
            </div>
            <button class={styles.fileDownload} onClick={() => downloadFile(file)}>
              Download
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
