import { createSignal, createEffect, For, Show, onMount } from 'solid-js'
import { state, showNotification } from '../store'
import { sendCommand, reloadSession } from '../ws'

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

function shortPath(cwd: string): string {
  // Show just the last 2 path segments for readability
  const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : cwd
}

export default function SessionSidebar() {
  const [groups, setGroups] = createSignal<WorkspaceGroup[]>([])
  const [renamingPath, setRenamingPath] = createSignal<string | null>(null)
  const [renameValue, setRenameValue] = createSignal('')
  const [openMenuPath, setOpenMenuPath] = createSignal<string | null>(null)

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

  onMount(() => { loadSessions() })

  // Reload sessions whenever the current session changes
  createEffect(() => {
    const _ = state.sessionFile
    loadSessions()
  })

  function toggleGroup(cwd: string) {
    setGroups((gs) => gs.map((g) => g.cwd === cwd ? { ...g, collapsed: !g.collapsed } : g))
  }

  async function openSession(sessionPath: string) {
    setOpenMenuPath(null)
    try {
      await sendCommand({ type: 'switch_session', sessionPath })
      await reloadSession()
    } catch {
      showNotification('Failed to switch session', 'error')
    }
  }

  function startRename(s: SessionItem) {
    setOpenMenuPath(null)
    setRenamingPath(s.path)
    setRenameValue(s.name ?? '')
  }

  async function commitRename(sessionPath: string) {
    const name = renameValue().trim()
    if (!name) { setRenamingPath(null); return }
    try {
      // If it's the current session, use set_session_name directly
      if (state.sessionFile === sessionPath) {
        await sendCommand({ type: 'set_session_name', name })
      } else {
        // For non-active sessions we'd need a different approach;
        // for now, only allow renaming the active session
        showNotification('Can only rename the active session', 'warning')
        setRenamingPath(null)
        return
      }
      setRenamingPath(null)
      await loadSessions()
    } catch {
      showNotification('Failed to rename session', 'error')
    }
  }

  async function deleteSession(sessionPath: string) {
    setOpenMenuPath(null)
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

  function handleMenuClick(e: MouseEvent, sessionPath: string) {
    e.stopPropagation()
    setOpenMenuPath((p) => (p === sessionPath ? null : sessionPath))
  }

  // Close menu on outside click
  function handleDocClick() {
    setOpenMenuPath(null)
  }

  return (
    <aside class="session-sidebar" onClick={handleDocClick}>
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
                        onClick={() => openSession(s.path)}
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
                            onClick={(e) => handleMenuClick(e, s.path)}
                          >⋯</button>
                          <Show when={openMenuPath() === s.path}>
                            <div class="sidebar-dropdown" onClick={(e) => e.stopPropagation()}>
                              <button class="sidebar-dropdown-item" onClick={() => startRename(s)}>Rename</button>
                              <button class="sidebar-dropdown-item danger" onClick={() => deleteSession(s.path)}>Delete</button>
                            </div>
                          </Show>
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
    </aside>
  )
}
