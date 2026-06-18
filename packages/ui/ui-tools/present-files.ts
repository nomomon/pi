import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import { readFileSync, existsSync, statSync } from "node:fs"
import { basename, extname } from "node:path"

const MIME_MAP: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ts': 'text/plain',
  '.tsx': 'text/plain',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
}

export default function registerPresentFiles(pi: ExtensionAPI) {
  pi.registerTool({
    name: "present_files",
    label: "Present Files",
    description: "Makes files visible to the user for viewing and downloading in the client interface. Use after creating a file the user should see. Do not use for temporary/internal files.",
    promptSnippet: "Present files to the user for viewing or download",
    promptGuidelines: [
      "Use present_files after creating or generating any file the user should view or download.",
      "Use present_files when the user asks to see, view, or download a file.",
      "Do not use for internal/temporary files you only need to read yourself.",
      "The first file in the array is shown first.",
    ],
    parameters: Type.Object({
      filepaths: Type.Array(Type.String({ description: "Absolute path to file" }), {
        description: "Array of file paths to present to the user",
        minItems: 1,
      }),
    }),
    async execute(_toolCallId, params) {
      const files: Array<Record<string, unknown>> = []

      for (const filepath of params.filepaths) {
        const cleanPath = filepath.startsWith('@') ? filepath.slice(1) : filepath

        if (!existsSync(cleanPath)) {
          files.push({ error: `File not found: ${cleanPath}`, path: cleanPath })
          continue
        }

        const buffer = readFileSync(cleanPath)
        const stat = statSync(cleanPath)
        const ext = extname(cleanPath).toLowerCase()
        const mime_type = MIME_MAP[ext] ?? 'application/octet-stream'

        files.push({
          name: basename(cleanPath),
          path: cleanPath,
          content_base64: buffer.toString('base64'),
          mime_type,
          size: stat.size,
        })
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ files }) }],
        details: { fileCount: files.length },
      }
    },
  })
}
