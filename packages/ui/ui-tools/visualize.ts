import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"

function buildDesignContext(_modules: string[], _platform: string): string {
  return `DESIGN SYSTEM CONTEXT

CSS Variables available in widgets:
--bg: #1a1a1a                   main background
--bg-surface: #212121           surface/card background
--bg-input: #2a2a2a             input background
--bg-bubble: #2d2d2d            message bubble background
--bg-hover: #2e2e2e             hover state
--bg-active: #363636            active/selected state
--border: #333                  border color
--text: #ececec                 primary text
--text-dim: #777                dimmed text
--text-muted: #999              muted text
--accent: #c96442               brand accent (terracotta orange)
--green: #4ec9b0
--red: #f44747
--yellow: #dcdcaa
--orange: #ce9178
--purple: #c586c0
--font: 'Menlo','Monaco','Cascadia Code','Consolas',monospace
--font-sans: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px  --space-8: 32px
--radius-sm: 6px   --radius-md: 10px   --radius-lg: 16px   --radius-full: 9999px
--text-xs: 11px  --text-sm: 12px  --text-base: 14px  --text-md: 16px
--text-lg: 18px  --text-xl: 20px  --text-2xl: 24px

WIDGET RULES:
- Use CSS variables for ALL colors and spacing. Never hardcode hex values except in SVG fill attributes.
- Dark theme only — base background is #1a1a1a.
- Use var(--font) for code/data content, var(--font-sans) for UI labels.
- Prefer var(--radius-md) for cards/panels.
- A global \`sendPrompt(text: string)\` function is pre-injected — calling it sends text to the chat as if the user typed it.

SVG MODE (widget_code starts with <svg):
- viewBox="0 0 800 600" for landscape, "0 0 600 600" for square. Mobile: "0 0 400 500".
- Add role="img" aria-label="...".
- Open with <rect width="100%" height="100%" fill="var(--bg)"/> for consistent dark background.
- CSS <style> block inside <svg> can use var() references.

HTML MODE (anything else):
- No <html>, <head>, or <body> tags — provide raw HTML only.
- Scripts execute after streaming completes.
- sendPrompt() is pre-injected as a global function.
- Fetch and XHR are blocked by sandbox — all data must be inline.
- Start with a <style> block that sets body { margin: 0; padding: 16px; background: var(--bg); color: var(--text); font-family: var(--font-sans); }

EXAMPLE SVG (bar chart):
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Bar chart">
  <style>
    text { fill: var(--text); font-family: var(--font-sans); font-size: 12px; }
    .bar { fill: var(--accent); }
  </style>
  <rect width="600" height="400" fill="var(--bg)"/>
  <rect class="bar" x="50" y="100" width="80" height="250"/>
  <text x="90" y="375" text-anchor="middle">Jan</text>
</svg>

EXAMPLE HTML (interactive button):
<style>
  body { margin: 0; padding: 16px; background: var(--bg); color: var(--text); font-family: var(--font-sans); }
  button { background: var(--accent); color: white; border: none; padding: 8px 16px; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; }
  button:hover { opacity: 0.85; }
</style>
<div>
  <h2 style="margin-bottom: 12px; font-size: 16px;">Quick Actions</h2>
  <button onclick="sendPrompt('Run the tests')">Run tests</button>
  <button onclick="sendPrompt('Show git diff')" style="margin-left: 8px;">Git diff</button>
</div>`
}

export default function registerVisualize(pi: ExtensionAPI) {
  pi.registerTool({
    name: "visualize_read_me",
    label: "Visualize Read Me",
    description: "Returns the design system context required before calling visualize_show_widget. Must be called before the first show_widget call. Do not narrate this call to the user.",
    promptSnippet: "Load design system context before rendering widgets",
    promptGuidelines: [
      "Always call visualize_read_me before your first visualize_show_widget call.",
      "Do not mention or narrate this call — it is an internal setup step.",
    ],
    parameters: Type.Object({
      modules: Type.Array(Type.String(), {
        description: 'Modules needed: "diagram", "mockup", "interactive", "data_viz", "art", "chart", "elicitation"',
      }),
      platform: Type.String({ description: '"mobile" | "desktop" | "unknown"' }),
    }),
    async execute(_toolCallId, params) {
      const context = buildDesignContext(params.modules, params.platform)
      return {
        content: [{ type: "text", text: context }],
        details: {},
      }
    },
  })

  pi.registerTool({
    name: "visualize_show_widget",
    label: "Show Widget",
    description: "Renders SVG graphics, diagrams, charts, or interactive HTML widgets inline in the chat. Starts with <svg → SVG mode; anything else → HTML mode.",
    promptSnippet: "Render SVG or HTML widget inline in the chat",
    promptGuidelines: [
      "Always call visualize_read_me before your first visualize_show_widget.",
      "title must be snake_case, no spaces — used as download filename.",
      "loading_messages: 1–4 short phrases shown while rendering. Be playful (puns/alliteration) unless the topic is serious.",
    ],
    parameters: Type.Object({
      title: Type.String({ description: "Snake_case identifier used as download filename (e.g. oauth_login_flow)" }),
      widget_code: Type.String({ description: "Raw SVG starting with <svg, or raw HTML (no html/head/body tags)" }),
      loading_messages: Type.Array(Type.String(), {
        description: "1–4 short loading messages shown while rendering",
        minItems: 1,
        maxItems: 4,
      }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: JSON.stringify({ title: params.title, widget_code: params.widget_code }) }],
        details: { title: params.title, mode: params.widget_code.trimStart().startsWith('<svg') ? 'svg' : 'html' },
      }
    },
  })
}
