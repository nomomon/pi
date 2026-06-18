import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import registerPresentFiles from "./present-files"
import registerVisualize from "./visualize"

export default function(pi: ExtensionAPI) {
  registerPresentFiles(pi)
  registerVisualize(pi)
}
