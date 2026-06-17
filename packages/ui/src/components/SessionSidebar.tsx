import { createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import { state, showNotification } from '../store'
import { sendCommand, reloadSession, openInWorkspace } from '../ws'

interface SessionItem {
  path: string
  id: string
  name?: string
  cwd: string
  modified: string
  messageCount: number
  firstMessage: string
}

interface WorkspaceGroup {
  cwd: string
  sessions: SessionItem[]
  collapsed: boolean
}

interface MenuState {
  sessionPath: string
  session: SessionItem
  top: number
  left: number
}

function shortPath(cwd: string): string {
  // Show just the last 2 path segments for readability
  const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : cwd
}

export default function SessionSidebar() {
  const [groups, setGroups] = createSignal<WorkspaceGroup[]>([])
  const [renamingPath, setRenamingPath] = createSignal<string | null>(null)
  const [renameValue, setRenameValue] = createSignal('')
  const [menuState, setMenuState] = createSignal<MenuState | null>(null)

  async function loadSessions() {
    try {
      const result = await sendCommand({ type: 'list_sessions' })
      const sessions: SessionItem[] = result?.sessions ?? []
      // Group by cwd
      const map = new Map<string, SessionItem[]>()
      for (const s of sessions) {
        const key = s.cwd || '(unknown)'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(s)
      }
      setGroups((prev) =>
        Array.from(map.entries()).map(([cwd, sessions]) => {
          const existing = prev.find((g) => g.cwd === cwd)
          return { cwd, sessions, collapsed: existing?.collapsed ?? false }
        })
      )
    } catch {
      // silent fail
    }
  }

  onMount(() => {
    loadSessions()
    const close = () => setMenuState(null)
    document.addEventListener('click', close)
    onCleanup(() => document.removeEventListener('click', close))
  })

  // Reload sessions whenever the current session file or name changes
  createEffect(() => {
    const _f = state.sessionFile
    const _n = state.sessionName
    loadSessions()
  })

  function toggleGroup(cwd: string) {
    setGroups((gs) => gs.map((g) => g.cwd === cwd ? { ...g, collapsed: !g.collapsed } : g))
  }

  async function openSession(s: SessionItem) {
    setMenuState(null)
    openInWorkspace(s.path, s.cwd || '')
  }

  function startRename(s: SessionItem) {
    setRenamingPath(s.path)
    setRenameValue(s.name ?? '')
  }

  async function commitRename(sessionPath: string) {
    const name = renameValue().trim()
    setRenamingPath(null)
    if (!name) return
    try {
      if (state.sessionFile === sessionPath) {
        await sendCommand({ type: 'set_session_name', name })
      } else {
        await sendCommand({ type: 'rename_session', sessionPath, name })
      }
      await loadSessions()
    } catch {
      showNotification('Failed to rename session', 'error')
    }
  }

  async function deleteSession(sessionPath: string) {
    setMenuState(null)
    if (!confirm('Delete this session?')) return
    const wasCurrent = state.sessionFile === sessionPath
    try {
      await sendCommand({ type: 'delete_session', sessionPath })
      if (wasCurrent) {
        await sendCommand({ type: 'new_session' })
        await reloadSession()
      }
      await loadSessions()
      showNotification('Session deleted', 'info')
    } catch {
      showNotification('Failed to delete session', 'error')
    }
  }

  function openMenu(e: MouseEvent, s: SessionItem) {
    e.stopPropagation()
    if (menuState()?.sessionPath === s.path) { setMenuState(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuState({ sessionPath: s.path, session: s, top: rect.bottom + 2, left: rect.right - 120 })
  }

  return (
    <aside class="session-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Sessions</span>
        <button class="sidebar-new-btn" title="New session" onClick={async (e) => {
          e.stopPropagation()
          await sendCommand({ type: 'new_session' })
          await reloadSession()
          await loadSessions()
        }}>+</button>
      </div>
      <div class="sidebar-list">
        <For each={groups()}>
          {(group) => (
            <div class="sidebar-group">
              <button class="sidebar-group-header" onClick={() => toggleGroup(group.cwd)}>
                <span class="sidebar-group-arrow">{group.collapsed ? '▶' : '▼'}</span>
                <span class="sidebar-group-name" title={group.cwd}>{shortPath(group.cwd)}</span>
                <span class="sidebar-group-count">{group.sessions.length}</span>
              </button>
              <Show when={!group.collapsed}>
                <div class="sidebar-group-sessions">
                  <For each={group.sessions}>
                    {(s) => (
                      <div
                        class={`sidebar-session ${state.sessionFile === s.path ? 'active' : ''}`}
                        onClick={() => openSession(s)}
                      >
                        <Show when={renamingPath() === s.path}>
                          <input
                            class="sidebar-rename-input"
                            value={renameValue()}
                            onInput={(e) => setRenameValue(e.currentTarget.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') commitRename(s.path)
                              if (e.key === 'Escape') setRenamingPath(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={() => commitRename(s.path)}
                            ref={(el) => setTimeout(() => el?.focus(), 0)}
                          />
                        </Show>
                        <Show when={renamingPath() !== s.path}>
                          <span class="sidebar-session-name">
                            {s.name ?? s.id.slice(0, 8)}
                          </span>
                          <Show when={s.firstMessage}>
                            <span class="sidebar-session-preview">{s.firstMessage.slice(0, 40)}</span>
                          </Show>
                        </Show>
                        <div class="sidebar-session-menu-wrap">
                          <button
                            class="sidebar-menu-btn"
                            title="Options"
                            onClick={(e) => openMenu(e, s)}
                          >⋯</button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
        <Show when={groups().length === 0}>
          <div class="sidebar-empty">No sessions</div>
        </Show>
      </div>
      <Show when={menuState() !== null}>
        <Portal>
          <div
            class="sidebar-dropdown"
            style={{
              position: 'fixed',
              top: `${menuState()!.top}px`,
              left: `${menuState()!.left}px`,
              'z-index': '9999',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button class="sidebar-dropdown-item" onClick={() => { startRename(menuState()!.session); setMenuState(null) }}>Rename</button>
            <button class="sidebar-dropdown-item danger" onClick={() => { deleteSession(menuState()!.sessionPath); setMenuState(null) }}>Delete</button>
          </div>
        </Portal>
      </Show>
    </aside>
  )
}
