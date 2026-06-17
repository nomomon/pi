import { produce } from "solid-js/store";
import { addMessage, applySessionState, setState, showNotification, state, updateMessage } from "./store";
import type { AgentEvent, RpcCommand, RpcResponse } from "./types";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let idCounter = 0;
let cwdOverride: string | null = null;
let pendingSessionPath: string | null = null;

function genId() {
	return `cmd_${++idCounter}`;
}

export function connect() {
	if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

	setState("connecting", true);

	const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
	const cwd = cwdOverride ?? new URLSearchParams(window.location.search).get("cwd") ?? "";
	const url = `${proto}//${window.location.host}/ws${cwd ? `?cwd=${encodeURIComponent(cwd)}` : ""}`;

	ws = new WebSocket(url);

	ws.onopen = () => {
		setState({ connected: true, connecting: false });
		showNotification("Connected", "info", 1500);
		// Fetch initial state
		sendCommand({ type: "get_state" }).then((data) => {
			if (data) applySessionState(data);
		});
		sendCommand({ type: "get_messages" }).then((data: any) => {
			if (data?.messages) {
				for (const msg of data.messages) {
					processHistoricalMessage(msg);
				}
			}
		});
		// Fetch slash commands for autocomplete
		sendCommand({ type: "get_commands" })
			.then((data: any) => {
				if (data?.commands) {
					setState("slashCommands", data.commands);
				}
			})
			.catch(() => {});
		// Handle pending session switch (e.g. opening a session from a different workspace)
		if (pendingSessionPath) {
			const path = pendingSessionPath;
			pendingSessionPath = null;
			sendCommand({ type: "switch_session", sessionPath: path }).then(() => reloadSession());
		}
	};

	ws.onmessage = (event) => {
		try {
			const obj = JSON.parse(event.data);
			handleMessage(obj);
		} catch (e) {
			console.error("Failed to parse WS message:", e, event.data);
		}
	};

	ws.onclose = () => {
		setState({ connected: false, connecting: false });
		ws = null;
		scheduleReconnect();
	};

	ws.onerror = (err) => {
		console.error("WS error:", err);
		setState({ connected: false, connecting: false });
	};
}

function scheduleReconnect() {
	if (reconnectTimer) clearTimeout(reconnectTimer);
	reconnectTimer = setTimeout(() => {
		connect();
	}, 2000);
}

export function send(command: RpcCommand) {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		console.warn("WS not connected, dropping command", command);
		return;
	}
	ws.send(JSON.stringify(command));
}

export async function reloadSession() {
	setState("messages", []);
	histToolArgs.clear();
	const [stateData, msgData] = await Promise.all([
		sendCommand({ type: "get_state" }),
		sendCommand({ type: "get_messages" }),
	]);
	if (stateData) applySessionState(stateData);
	if (msgData?.messages) {
		for (const msg of msgData.messages) {
			processHistoricalMessage(msg);
		}
	}
}

export function sendBash(command: string, excludeFromContext = false) {
	const entryId = `bash_${Date.now()}`;
	addMessage({
		id: entryId,
		type: "bash",
		timestamp: Date.now(),
		bashCommand: command,
		bashIsRunning: true,
	});
	sendCommand({ type: "bash", command, excludeFromContext })
		.then((result: any) => {
			updateMessage(entryId, (e) => {
				e.bashIsRunning = false;
				e.bashOutput = result?.output ?? "";
				e.bashExitCode = result?.exitCode;
				e.bashTruncated = result?.truncated;
			});
		})
		.catch((err: Error) => {
			updateMessage(entryId, (e) => {
				e.bashIsRunning = false;
				e.bashOutput = `Error: ${err.message}`;
				e.bashExitCode = 1;
			});
		});
}

export function sendCommand<T = any>(command: RpcCommand): Promise<T> {
	return new Promise((resolve, reject) => {
		const id = genId();
		const cmd = { ...command, id };

		setState(
			produce((s) => {
				s.pendingResponses[id] = { resolve: resolve as any, reject };
			}),
		);

		// Timeout after 15s
		const timer = setTimeout(() => {
			setState(
				produce((s) => {
					delete s.pendingResponses[id];
				}),
			);
			reject(new Error("Command timed out"));
		}, 15000);

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			clearTimeout(timer);
			setState(
				produce((s) => {
					delete s.pendingResponses[id];
				}),
			);
			reject(new Error("Not connected"));
			return;
		}

		ws.send(JSON.stringify(cmd));
	});
}

function handleMessage(obj: any) {
	// Handle RPC responses
	if (obj.type === "response") {
		const resp = obj as RpcResponse;
		if (resp.id && state.pendingResponses[resp.id]) {
			const { resolve, reject } = state.pendingResponses[resp.id];
			setState(
				produce((s) => {
					delete s.pendingResponses[resp.id!];
				}),
			);
			if (resp.success) {
				resolve(resp.data);
			} else {
				reject(new Error(resp.error));
			}
		}
		return;
	}

	// Handle agent events
	const event = obj as AgentEvent;
	handleAgentEvent(event);
}

function handleAgentEvent(event: AgentEvent) {
	switch (event.type) {
		case "agent_start":
			setState({ isStreaming: true });
			break;

		case "agent_end":
			setState({ isStreaming: false, streamingEntryId: null });
			break;

		case "message_start": {
			const msg = event.message;
			if (msg.role === "user") {
				const text = typeof msg.content === "string" ? msg.content : msg.content.map((c) => c.text).join("");
				addMessage({
					id: `msg_${Date.now()}_user`,
					type: "user",
					timestamp: msg.timestamp,
					text,
				});
			} else if (msg.role === "assistant") {
				const entryId = `msg_${Date.now()}_asst`;
				const textBlocks = msg.content.filter((c) => c.type === "text") as any[];
				const thinkingBlocks = msg.content.filter((c) => c.type === "thinking") as any[];
				const toolCalls = msg.content.filter((c) => c.type === "toolCall") as any[];
				addMessage({
					id: entryId,
					type: "assistant",
					timestamp: msg.timestamp,
					textBlocks,
					thinkingBlocks,
					toolCalls,
					usage: (msg as any).usage,
					model: (msg as any).model,
					stopReason: (msg as any).stopReason,
					isPartial: true,
				});
				setState("streamingEntryId", entryId);
			}
			break;
		}

		case "message_update": {
			const msg = event.message;
			if (msg.role === "assistant" && state.streamingEntryId) {
				const textBlocks = msg.content.filter((c) => c.type === "text") as any[];
				const thinkingBlocks = msg.content.filter((c) => c.type === "thinking") as any[];
				const toolCalls = msg.content.filter((c) => c.type === "toolCall") as any[];
				updateMessage(state.streamingEntryId, (e) => {
					e.textBlocks = textBlocks;
					e.thinkingBlocks = thinkingBlocks;
					e.toolCalls = toolCalls;
					e.isPartial = true;
				});
			}
			break;
		}

		case "message_end": {
			const msg = event.message;
			if (msg.role === "assistant" && state.streamingEntryId) {
				const id = state.streamingEntryId;
				const textBlocks = msg.content.filter((c) => c.type === "text") as any[];
				const thinkingBlocks = msg.content.filter((c) => c.type === "thinking") as any[];
				const toolCalls = msg.content.filter((c) => c.type === "toolCall") as any[];
				updateMessage(id, (e) => {
					e.textBlocks = textBlocks;
					e.thinkingBlocks = thinkingBlocks;
					e.toolCalls = toolCalls;
					e.usage = (msg as any).usage;
					e.model = (msg as any).model;
					e.stopReason = (msg as any).stopReason;
					e.isPartial = false;
				});
				setState("streamingEntryId", null);
				// Update total tokens
				if ((msg as any).usage?.totalTokens) {
					setState("totalTokens", (msg as any).usage.totalTokens);
				}
			}
			break;
		}

		case "tool_execution_start": {
			const { toolCallId, toolName, args } = event;
			const entryId = `tool_${toolCallId}`;
			setState(
				produce((s) => {
					s.toolExecutions[toolCallId] = {
						toolCallId,
						toolName,
						args,
						isRunning: true,
					};
				}),
			);
			addMessage({
				id: entryId,
				type: "tool_execution",
				timestamp: Date.now(),
				toolCallId,
				toolName,
				toolArgs: args,
				toolIsRunning: true,
			});
			break;
		}

		case "tool_execution_update": {
			const { toolCallId, partialResult } = event;
			setState(
				produce((s) => {
					if (s.toolExecutions[toolCallId]) {
						s.toolExecutions[toolCallId].partialResult = partialResult;
					}
				}),
			);
			updateMessage(`tool_${toolCallId}`, (e) => {
				e.toolPartialResult = partialResult;
			});
			break;
		}

		case "tool_execution_end": {
			const { toolCallId, result, isError } = event;
			setState(
				produce((s) => {
					if (s.toolExecutions[toolCallId]) {
						s.toolExecutions[toolCallId].isRunning = false;
						s.toolExecutions[toolCallId].result = result;
						s.toolExecutions[toolCallId].isError = isError;
					}
				}),
			);
			updateMessage(`tool_${toolCallId}`, (e) => {
				e.toolIsRunning = false;
				e.toolResult = result;
				e.toolIsError = isError;
			});
			break;
		}

		case "compaction_start":
			setState({ isCompacting: true });
			addMessage({
				id: `compact_${Date.now()}`,
				type: "compaction",
				timestamp: Date.now(),
				message: "Compacting conversation...",
			});
			break;

		case "compaction_end":
			setState({ isCompacting: false });
			break;

		case "model_update":
			setState("model", event.model);
			break;

		case "abort":
			setState({ isStreaming: false, streamingEntryId: null });
			addMessage({
				id: `system_${Date.now()}`,
				type: "system",
				timestamp: Date.now(),
				message: "Aborted",
			});
			break;

		case "error":
			addMessage({
				id: `err_${Date.now()}`,
				type: "system",
				timestamp: Date.now(),
				message: `Error: ${(event as any).message}`,
			});
			break;
	}
}

export function openInWorkspace(sessionPath: string, cwd: string) {
	cwdOverride = cwd;
	pendingSessionPath = sessionPath;
	if (ws) {
		const old = ws;
		ws = null;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		old.onclose = null;
		old.onerror = null;
		old.close();
	}
	setState({ connected: false, connecting: false });
	connect();
}

const histToolArgs = new Map<string, any>();

function processHistoricalMessage(msg: any) {
	if (msg.role === "user") {
		const text = typeof msg.content === "string" ? msg.content : msg.content.map((c: any) => c.text).join("");
		addMessage({
			id: `hist_${msg.timestamp}_user`,
			type: "user",
			timestamp: msg.timestamp,
			text,
		});
	} else if (msg.role === "assistant") {
		const textBlocks = msg.content.filter((c: any) => c.type === "text");
		const thinkingBlocks = msg.content.filter((c: any) => c.type === "thinking");
		const toolCalls = msg.content.filter((c: any) => c.type === "toolCall");
		for (const tc of toolCalls) {
			histToolArgs.set(tc.id, tc.arguments);
		}
		addMessage({
			id: `hist_${msg.timestamp}_asst`,
			type: "assistant",
			timestamp: msg.timestamp,
			textBlocks,
			thinkingBlocks,
			toolCalls,
			usage: msg.usage,
			model: msg.model,
			stopReason: msg.stopReason,
			isPartial: false,
		});
	} else if (msg.role === "toolResult") {
		addMessage({
			id: `hist_${msg.timestamp}_tool_${msg.toolCallId}`,
			type: "tool_execution",
			timestamp: msg.timestamp,
			toolCallId: msg.toolCallId,
			toolName: msg.toolName,
			toolArgs: histToolArgs.get(msg.toolCallId),
			toolResult: msg.content?.map((c: any) => c.text).join(""),
			toolIsError: msg.isError,
			toolIsRunning: false,
		});
	}
}
