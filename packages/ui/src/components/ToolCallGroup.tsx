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
            <div class="tl-icon-col"><div class="tl-spine-seg" /></div>
            <div class="tl-spacer-fill" />
        </div>
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
                    {/* Done node: spine tail extends below the icon, no bottom spacer */}
                    <div class="tl-node">
                        <Spacer class="tl-spacer-top" />
                        <div class="tl-row">
                            <div class="tl-icon-col tl-icon-col-done">
                                <div class="tl-icon tl-icon-done"><CheckCircle2 size={16} /></div>
                                <div class="tl-spine-tail" />
                            </div>
                            <div class="tl-content">
                                <span class="tl-label-done">Done</span>
                            </div>
                        </div>
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
                    <div class={`tl-btn tl-btn-plain`}>
                        <span class={`tl-label ${props.labelClass ?? ''}`}>{props.label}</span>
                    </div>
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
            <div class="tl-row" style={{ 'align-items': 'flex-start', 'padding-top': '3px' }}>
                <div class="tl-icon-col" style={{ 'padding-top': '1px' }}>
                    <div class="tl-icon tl-icon-thinking"><ClockFading size={16} /></div>
                </div>
                <div class="tl-content">
                    <button class="tl-btn" style={{ 'align-items': 'flex-start' }} onClick={props.onToggle}>
                        <span class={`tl-label-preview${props.expanded ? ' tl-label-preview-open' : ''}`}>
                            {preview() || 'Thought process'}
                        </span>
                    </button>
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
        return 'done'
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
                    <div class="tl-icon-col"><div class="tl-spine-full" /></div>
                    <div class="tl-detail-content">
                        <Show when={props.entry.toolName === 'bash'} fallback={
                            <>
                                <Show when={props.entry.toolArgs}>
                                    <div class="timeline-detail-section">
                                        <div class="timeline-detail-label">Input</div>
                                        <pre class="timeline-detail-code">{JSON.stringify(props.entry.toolArgs, null, 2)}</pre>
                                    </div>
                                </Show>
                                <Show when={resultText()}>
                                    <div class="timeline-detail-section">
                                        <div class="timeline-detail-label">{props.entry.toolIsError ? 'Error' : 'Output'}</div>
                                        <pre class={`timeline-detail-code${props.entry.toolIsError ? ' timeline-detail-error' : ''}`}>{resultText()}</pre>
                                    </div>
                                </Show>
                                <Show when={props.entry.toolIsRunning && !resultText()}>
                                    <div class="timeline-detail-dim">Running…</div>
                                </Show>
                            </>
                        }>
                            <div class="tl-terminal">
                                <div class="tl-terminal-cmd">
                                    <span class="tl-terminal-prompt">$</span>{props.entry.toolArgs?.command}
                                </div>
                                <Show when={resultText()}>
                                    <pre class={`tl-terminal-output${props.entry.toolIsError ? ' timeline-detail-error' : ''}`}>{resultText()}</pre>
                                </Show>
                                <Show when={props.entry.toolIsRunning && !resultText()}>
                                    <div class="timeline-detail-dim">Running…</div>
                                </Show>
                            </div>
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
                    <div class={`tl-icon ${props.entry.bashIsRunning ? 'tl-icon-running' : exitOk() ? 'tl-icon-dim' : 'tl-icon-error'}`}>
                        <Show when={props.entry.bashIsRunning} fallback={<TerminalSquare size={16} />}>
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
                    <div class="tl-icon-col"><div class="tl-spine-full" /></div>
                    <div class="tl-detail-content">
                        <div class="tl-terminal">
                            <div class="tl-terminal-cmd">
                                <span class="tl-terminal-prompt">$</span>{props.entry.bashCommand}
                            </div>
                            <Show when={props.entry.bashOutput}>
                                <pre class="tl-terminal-output">{props.entry.bashOutput}</pre>
                            </Show>
                            <Show when={props.entry.bashTruncated}>
                                <div class="timeline-detail-dim" style={{ 'font-style': 'italic', 'margin-top': '3px' }}>output truncated</div>
                            </Show>
                        </div>
                    </div>
                </div>
            </div>
            <Spacer class="tl-spacer-bottom" />
        </div>
    )
}
