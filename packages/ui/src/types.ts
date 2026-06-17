// ---- Content types ----

export interface TextContent {
  type: 'text'
  text: string
}

export interface ThinkingContent {
  type: 'thinking'
  thinking: string
  redacted?: boolean
}

export interface ToolCall {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, any>
}

export interface Usage {
  input: number
  output: number
  totalTokens: number
  cost?: { total: number }
}

// ---- Agent messages ----

export interface UserMessage {
  role: 'user'
  content: string | TextContent[]
  timestamp: number
}

export interface AssistantMessage {
  role: 'assistant'
  content: (TextContent | ThinkingContent | ToolCall)[]
  usage: Usage
  model: string
  stopReason: string
  timestamp: number
}

export interface ToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: TextContent[]
  isError?: boolean
  timestamp: number
}

export type AgentMessage = UserMessage | AssistantMessage | ToolResultMessage

// ---- RPC types ----

export type RpcCommand =
  | { id?: string; type: 'prompt'; message: string; streamingBehavior?: 'steer' | 'followUp' }
  | { id?: string; type: 'abort' }
  | { id?: string; type: 'get_state' }
  | { id?: string; type: 'set_model'; provider: string; modelId: string }
  | { id?: string; type: 'get_available_models' }
  | { id?: string; type: 'set_thinking_level'; level: 'none' | 'low' | 'medium' | 'high' | 'auto' }
  | { id?: string; type: 'compact'; customInstructions?: string }
  | { id?: string; type: 'bash'; command: string; excludeFromContext?: boolean }
  | { id?: string; type: 'get_session_stats' }
  | { id?: string; type: 'switch_session'; sessionPath: string }
  | { id?: string; type: 'fork'; entryId: string }
  | { id?: string; type: 'new_session' }
  | { id?: string; type: 'get_messages' }
  | { id?: string; type: 'get_commands' }
  | { id?: string; type: 'get_fork_messages' }
  | { id?: string; type: 'set_session_name'; name: string }
  | { id?: string; type: 'export_html'; outputPath?: string }
  | { id?: string; type: 'list_sessions'; cwd?: string }

export type RpcResponse =
  | { id?: string; type: 'response'; command: string; success: true; data?: any }
  | { id?: string; type: 'response'; command: string; success: false; error: string }

export interface RpcSessionState {
  model?: { id: string; provider: string; name?: string; [key: string]: any }
  thinkingLevel: 'none' | 'low' | 'medium' | 'high' | 'auto'
  isStreaming: boolean
  isCompacting: boolean
  sessionFile?: string
  sessionId: string
  sessionName?: string
  autoCompactionEnabled: boolean
  messageCount: number
  pendingMessageCount: number
}

// ---- Agent events ----

export type AgentEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages: AgentMessage[] }
  | { type: 'message_start'; message: AgentMessage }
  | { type: 'message_update'; message: AgentMessage; assistantMessageEvent: any }
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_execution_start'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool_execution_update'; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: 'tool_execution_end'; toolCallId: string; toolName: string; result: any; isError: boolean }
  | { type: 'compaction_start' }
  | { type: 'compaction_end' }
  | { type: 'session_before_compact' }
  | { type: 'session_compact' }
  | { type: 'model_update'; model: any }
  | { type: 'queue_update' }
  | { type: 'abort' }
  | { type: 'error'; message: string }

// ---- Slash command ----

export interface RpcSlashCommand {
  name: string
  description?: string
  source: 'extension' | 'prompt' | 'skill' | 'builtin'
}

// ---- Chat display types ----

export interface ChatEntry {
  id: string
  type: 'user' | 'assistant' | 'tool_execution' | 'bash' | 'compaction' | 'system'
  timestamp: number
  // user
  text?: string
  // assistant
  textBlocks?: TextContent[]
  thinkingBlocks?: ThinkingContent[]
  toolCalls?: ToolCall[]
  usage?: Usage
  model?: string
  stopReason?: string
  isPartial?: boolean
  // tool execution
  toolCallId?: string
  toolName?: string
  toolArgs?: any
  toolResult?: any
  toolIsError?: boolean
  toolIsRunning?: boolean
  toolPartialResult?: any
  // bash
  bashCommand?: string
  bashOutput?: string
  bashExitCode?: number
  bashIsRunning?: boolean
  bashTruncated?: boolean
  // compaction / system
  message?: string
}
