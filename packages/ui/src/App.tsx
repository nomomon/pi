import { onMount, Show } from 'solid-js'
import { state, setState } from './store'
import { connect } from './ws'
import ChatView from './components/ChatView'
import InputArea from './components/InputArea'
import Footer from './components/Footer'
import StatusBar from './components/StatusBar'
import ModelSelector from './components/ModelSelector'
import SessionSelector from './components/SessionSelector'

export default function App() {
  onMount(() => {
    connect()
  })

  return (
    <div class="app">
      <header class="app-header">
        <div class="header-left">
          <span class="app-title">pi</span>
          <Show when={state.sessionName}>
            <span class="session-name">{state.sessionName}</span>
          </Show>
        </div>
        <div class="header-right">
          <span class="hint">Enter: submit · Shift+Enter: newline · Ctrl+C: abort · /model /new /compact</span>
          <span class={`connection-dot ${state.connected ? 'connected' : state.connecting ? 'connecting' : 'disconnected'}`} />
        </div>
      </header>

      <ChatView />

      <StatusBar />

      <InputArea />

      <Footer />

      <Show when={state.notification}>
        {(n) => (
          <div class={`notification notification-${n().kind}`}>
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
