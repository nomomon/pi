import { For, Show, Switch, Match } from 'solid-js'
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, TerminalSquare, FilePlus, FileText, FilePen, Search, FolderOpen, Wrench, ClockFading } from 'lucide-solid'
import type { ChatEntry } from '../types'

function n(count: number, singular: string, plural: string): string {
    return count === 1 ? `a ${singular}` : `${count} ${plural}`
}

function summarize(entries: ChatEntry[]): string {
    let thinking = 0, commands = 0, created = 0, viewed = 0, edited = 0, compactions = 0

    for (const e of entries) {
        if (e.type === 'assistant') {
            thinking += e.thinkingBlocks?.length ?? 0
        } else if (e.type === 'tool_execution') {
            switch (e.toolName) {
                case 'write': created++; break
                case 'read': viewed++; break
                case 'edit': edited++; break
                default: commands++; break
            }
        } else if (e.type === 'bash') {
            commands++
        } else if (e.type === 'compaction') {
            compactions++
        }
    }

    const parts: string[] = []
    if (thinking > 0) parts.push(`Thought ${n(thinking, 'time', 'times')}`)
    if (commands > 0) parts.push(`${parts.length ? 'ran' : 'Ran'} ${n(commands, 'command', 'commands')}`)
    if (created > 0) parts.push(`${parts.length ? 'created' : 'Created'} ${n(created, 'file', 'files')}`)
    if (viewed > 0) parts.push(`${parts.length ? 'viewed' : 'Viewed'} ${n(viewed, 'file', 'files')}`)
    if (edited > 0) parts.push(`${parts.length ? 'edited' : 'Edited'} ${n(edited, 'file', 'files')}`)
    if (compactions > 0) parts.push(`${parts.length ? 'compacted' : 'Compacted'} context`)
    return parts.join(', ') || 'Step'
}

function ToolIcon(props: { name: string }) {
    switch (props.name) {
        case 'bash': return <TerminalSquare size={16} />
        case 'write': return <FilePlus size={16} />
        case 'read': return <FileText size={16} />
        case 'edit': return <FilePen size={16} />
        case 'grep': return <Search size={16} />
        case 'find': case 'ls': return <FolderOpen size={16} />
        default: return <Wrench size={16} />
    }
}

function toolVerb(name: string): string {
    switch (name) {
        case 'write': return 'Created'
        case 'read': return 'Read'
        case 'edit': return 'Edited'
        case 'grep': return 'Searched'
        case 'find': return 'Found'
        case 'ls': return 'Listed'
        case 'bash': return 'Ran'
        default: return name
    }
}

function toolTarget(name: string, args: any): string {
    switch (name) {
        case 'write': case 'read': case 'edit': return args?.file_path ?? ''
        case 'grep': return args?.pattern ?? ''
        case 'find': return args?.pattern ?? args?.path ?? ''
        case 'ls': return args?.path ?? '.'
        case 'bash': return (args?.command ?? '').split('\n')[0].slice(0, 80)
        default: return ''
    }
}

/** Top or bottom 8px spacer with the spine segment inside the icon column */
function Spacer(props: { class?: string }) {
    return (
        <div class={`tl-spacer ${props.class ?? ''}`}>
            <div class="tl-icon-col" />
            <div class="tl-spacer-fill" />
        </div>
    )
}

function ToolArgDisplay(props: { name: string; args: any }) {
    const label = () => {
        switch (props.name) {
            case 'read': case 'write': case 'edit': return 'File'
            case 'grep': return 'Pattern'
            case 'find': return 'Path'
            case 'ls': return 'Path'
            case 'bash': return 'Command'
            default: return 'Input'
        }
    }
    const value = () => {
        switch (props.name) {
            case 'read': case 'write': case 'edit': return props.args?.file_path ?? ''
            case 'grep': return props.args?.pattern ?? ''
            case 'find': return props.args?.pattern ?? props.args?.path ?? ''
            case 'ls': return props.args?.path ?? '.'
            case 'bash': return props.args?.command ?? ''
            default: return JSON.stringify(props.args, null, 2)
        }
    }
    return (
        <Show when={value()}>
            <div class="timeline-detail-section">
                <div class="timeline-detail-label">{label()}</div>
                <pre class="timeline-detail-code">{value()}</pre>
            </div>
        </Show>
    )
}

interface Props {
    entries: ChatEntry[]
    expanded: boolean
    onToggle: () => void
    itemExpanded: Record<string, boolean>
    onToggleItem: (id: string) => void
}

export default function StepGroup(props: Props) {
    return (
        <div class="step-group">
            <button class="step-group-header" onClick={props.onToggle}>
                <span class="step-group-chevron">
                    <Show when={props.expanded} fallback={<ChevronRight size={16} />}>
                        <ChevronDown size={16} />
                    </Show>
                </span>
                <span class="step-group-summary">{summarize(props.entries)}</span>
            </button>
            <div
                class="timeline-collapse"
                style={{ 'grid-template-rows': props.expanded ? '1fr' : '0fr' }}
            >
                <div class="timeline-body">
                    <For each={props.entries}>
                        {(entry) => (
                            <Switch>
                                <Match when={entry.type === 'assistant'}>
                                    <ThinkingNode
                                        entry={entry}
                                        expanded={props.itemExpanded[entry.id] ?? false}
                                        onToggle={() => props.onToggleItem(entry.id)}
                                    />
                                </Match>
                                <Match when={entry.type === 'tool_execution'}>
                                    <ToolNode
                                        entry={entry}
                                        expanded={props.itemExpanded[entry.id] ?? false}
                                        onToggle={() => props.onToggleItem(entry.id)}
                                    />
                                </Match>
                                <Match when={entry.type === 'bash'}>
                                    <BashNode
                                        entry={entry}
                                        expanded={props.itemExpanded[entry.id] ?? false}
                                        onToggle={() => props.onToggleItem(entry.id)}
                                    />
                                </Match>
                                <Match when={entry.type === 'compaction'}>
                                    <InlineNode iconClass="tl-icon-dim" icon={<span>↻</span>} label={entry.message ?? 'Context compacted'} />
                                </Match>
                                <Match when={entry.type === 'system'}>
                                    <InlineNode
                                        iconClass="tl-icon-dim"
                                        icon={<span>·</span>}
                                        label={entry.message ?? ''}
                                        labelClass={entry.message?.startsWith('Error') ? 'tl-label-error' : undefined}
                                    />
                                </Match>
                            </Switch>
                        )}
                    </For>
                    <div class="tl-node">
                        <Spacer class="tl-spacer-top" />
                        <div class="tl-row">
                            <div class="tl-icon-col">
                                <div class="tl-icon tl-icon-done"><CheckCircle2 size={16} /></div>
                            </div>
                            <div class="tl-content">
                                <span class="tl-label-done">Done</span>
                            </div>
                        </div>
                        <Spacer class="tl-spacer-bottom" />
                    </div>
                </div>
            </div>
        </div>
    )
}

/** Simple non-expandable inline node (compaction, system messages) */
function InlineNode(props: { iconClass: string; icon: any; label: string; labelClass?: string }) {
    return (
        <div class="tl-node">
            <Spacer class="tl-spacer-top" />
            <div class="tl-row">
                <div class="tl-icon-col">
                    <div class={`tl-icon ${props.iconClass}`}>{props.icon}</div>
                </div>
                <div class="tl-content">
                    <span class={`tl-label tl-label-inline ${props.labelClass ?? ''}`}>{props.label}</span>
                </div>
            </div>
            <Spacer class="tl-spacer-bottom" />
        </div>
    )
}

function ThinkingNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
    const blocks = () => props.entry.thinkingBlocks ?? []
    const preview = () => blocks().find(b => !b.redacted)?.thinking ?? ''

    return (
        <div class="tl-node">
            <Spacer class="tl-spacer-top" />
            <div class="tl-row tl-row-thinking">
                <div class="tl-icon-col">
                    <div class="tl-icon tl-icon-thinking"><ClockFading size={16} /></div>
                </div>
                <div class="tl-content">
                    <div class="tl-thinking-wrap">
                        <div class={`tl-thinking-text${props.expanded ? ' tl-thinking-text-open' : ''}`}>
                            {preview() || 'Thought process'}
                        </div>
                        <Show when={!props.expanded}>
                            <div class="tl-thinking-fade" />
                        </Show>
                        <button class="tl-thinking-toggle" onClick={props.onToggle}>
                            {props.expanded ? 'Show less' : 'Show more'}
                        </button>
                    </div>
                </div>
            </div>
            <Spacer class="tl-spacer-bottom" />
        </div>
    )
}

function ToolNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
    const status = () => {
        if (props.entry.toolIsRunning) return 'running'
        if (props.entry.toolIsError) return 'error'
        return 'dim'
    }

    const resultText = () => {
        const r = props.entry.toolResult ?? props.entry.toolPartialResult
        if (!r) return ''
        if (typeof r === 'string') return r
        if (Array.isArray(r)) return r.map((c: any) => c?.text ?? JSON.stringify(c)).join('\n')
        return JSON.stringify(r, null, 2)
    }

    return (
        <div class="tl-node">
            <Spacer class="tl-spacer-top" />
            <div class="tl-row">
                <div class="tl-icon-col">
                    <div class={`tl-icon tl-icon-${status()}`}>
                        <Show when={props.entry.toolIsRunning}>
                            <Loader2 size={16} class="spin" />
                        </Show>
                        <Show when={!props.entry.toolIsRunning && props.entry.toolIsError}>
                            <XCircle size={16} />
                        </Show>
                        <Show when={!props.entry.toolIsRunning && !props.entry.toolIsError}>
                            <ToolIcon name={props.entry.toolName ?? ''} />
                        </Show>
                    </div>
                </div>
                <div class="tl-content">
                    <button class="tl-btn" onClick={props.onToggle}>
                        <span class="tl-label">
                            <span class="tl-label-verb">{toolVerb(props.entry.toolName ?? '')}</span>
                            <Show when={toolTarget(props.entry.toolName ?? '', props.entry.toolArgs)}>
                                <code class="tl-label-code">{toolTarget(props.entry.toolName ?? '', props.entry.toolArgs)}</code>
                            </Show>
                        </span>
                    </button>
                </div>
            </div>
            <div class="tl-detail-collapse" style={{ 'grid-template-rows': props.expanded ? '1fr' : '0fr' }}>
                <div class="tl-detail-row">
                    <div class="tl-icon-col" />
                    <div class="tl-detail-content">
                        <ToolArgDisplay name={props.entry.toolName ?? ''} args={props.entry.toolArgs} />
                        <Show when={resultText()}>
                            <div class="timeline-detail-section">
                                <div class="timeline-detail-label">{props.entry.toolIsError ? 'Error' : 'Output'}</div>
                                <pre class={`timeline-detail-code${props.entry.toolIsError ? ' timeline-detail-error' : ''}`}>{resultText()}</pre>
                            </div>
                        </Show>
                        <Show when={props.entry.toolIsRunning && !resultText()}>
                            <div class="timeline-detail-dim">Running…</div>
                        </Show>
                    </div>
                </div>
            </div>
            <Spacer class="tl-spacer-bottom" />
        </div>
    )
}

function BashNode(props: { entry: ChatEntry; expanded: boolean; onToggle: () => void }) {
    const hasOutput = () => !!props.entry.bashOutput
    const shortCmd = () => (props.entry.bashCommand ?? '').split('\n')[0].slice(0, 80)
    const exitOk = () => (props.entry.bashExitCode ?? 0) === 0

    return (
        <div class="tl-node">
            <Spacer class="tl-spacer-top" />
            <div class="tl-row">
                <div class="tl-icon-col">
                    <div class={`tl-icon ${props.entry.bashIsRunning ? 'tl-icon-running' : !exitOk() ? 'tl-icon-error' : 'tl-icon-dim'}`}>
                        <Show when={props.entry.bashIsRunning} fallback={
                            <Show when={!exitOk()} fallback={<TerminalSquare size={16} />}>
                                <XCircle size={16} />
                            </Show>
                        }>
                            <Loader2 size={16} class="spin" />
                        </Show>
                    </div>
                </div>
                <div class="tl-content">
                    <button
                        class={`tl-btn${hasOutput() ? '' : ' tl-btn-plain'}`}
                        onClick={hasOutput() ? props.onToggle : undefined}
                    >
                        <span class="tl-label">
                            <span class="tl-label-verb">Ran</span>
                            <code class="tl-label-code">{shortCmd()}</code>
                            {!props.entry.bashIsRunning && !exitOk() && (
                                <span class="timeline-bash-exit"> · exit {props.entry.bashExitCode}</span>
                            )}
                        </span>
                    </button>
                </div>
            </div>
            <div class="tl-detail-collapse" style={{ 'grid-template-rows': props.expanded && hasOutput() ? '1fr' : '0fr' }}>
                <div class="tl-detail-row">
                    <div class="tl-icon-col" />
                    <div class="tl-detail-content">
                        <div class="timeline-detail-section">
                            <div class="timeline-detail-label">Command</div>
                            <pre class="timeline-detail-code">{props.entry.bashCommand}</pre>
                        </div>
                        <Show when={props.entry.bashOutput}>
                            <div class="timeline-detail-section">
                                <div class="timeline-detail-label">{exitOk() ? 'Output' : 'Error'}</div>
                                <pre class={`timeline-detail-code${!exitOk() ? ' timeline-detail-error' : ''}`}>{props.entry.bashOutput}</pre>
                            </div>
                        </Show>
                        <Show when={props.entry.bashIsRunning && !props.entry.bashOutput}>
                            <div class="timeline-detail-dim">Running…</div>
                        </Show>
                        <Show when={props.entry.bashTruncated}>
                            <div class="timeline-detail-dim" style={{ 'font-style': 'italic', 'margin-top': '3px' }}>output truncated</div>
                        </Show>
                    </div>
                </div>
            </div>
            <Spacer class="tl-spacer-bottom" />
        </div>
    )
}
