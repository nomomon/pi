import { onMount, Show } from 'solid-js'
import { state, setState } from './store'
import { connect } from './ws'
import ChatView from './features/chat/ChatView'
import InputArea from './features/input/InputArea'
import Footer from './shared/Footer'
import StatusBar from './shared/StatusBar'
import ModelSelector from './features/input/ModelSelector'
import SessionSelector from './features/sessions/SessionSelector'
import SessionSidebar from './features/sessions/SessionSidebar'
import styles from './App.module.css'

export default function App() {
  onMount(() => {
    connect()
  })

  return (
    <div class={styles.app}>
      <SessionSidebar />
      <div class={styles.mainContent}>
        <header class={styles.appHeader}>
          <div class={styles.headerLeft}>
            <span class={styles.appTitle}>pi</span>
            <Show when={state.sessionName}>
              <span class={styles.sessionName}>{state.sessionName}</span>
            </Show>
          </div>
          <div class={styles.headerRight}>
            <span class={`${styles.connectionDot} ${state.connected ? styles.connected : state.connecting ? styles.connecting : styles.disconnected}`} />
          </div>
        </header>

        <ChatView />

        <StatusBar />

        <InputArea />

        <Footer />
      </div>

      <Show when={state.notification}>
        {(n) => (
          <div class={`${styles.notification} ${n().kind === 'error' ? styles.notificationError : n().kind === 'warning' ? styles.notificationWarning : styles.notificationInfo}`}>
            {n().text}
          </div>
        )}
      </Show>

      <Show when={state.view === 'models'}>
        <ModelSelector onClose={() => setState('view', 'chat')} />
      </Show>

      <Show when={state.view === 'sessions'}>
        <SessionSelector onClose={() => setState('view', 'chat')} />
      </Show>
    </div>
  )
}
