import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { join } from "path"

/**
 * docs-check plugin for OpenCode
 *
 * Reminds the agent to read relevant docs before making changes.
 * (Docs summary injection is handled by docs-list-context.)
 */
export const DocsCheckPlugin: Plugin = async ({ directory, client }) => {
  let hasRemindedThisSession = false

  // Check if docs folder exists
  const docsDir = join(directory, "docs")
  const hasDocsFolder = existsSync(docsDir)

  return {
    // Before first edit, remind about docs
    "tool.execute.before": async (input, output) => {
      const editTools = ["edit", "write", "multi_edit", "patch", "apply_patch", "Edit", "Write", "MultiEdit", "Patch", "ApplyPatch"]
      
      if (editTools.includes(input.tool) && hasDocsFolder && !hasRemindedThisSession) {
        hasRemindedThisSession = true
        
        await client.app.log({
          service: "docs-check",
          level: "info",
          message: "📚 Reminder: docs/ exists. Run ./.ai-scripts/docs-list.sh, read relevant docs, and update them if your changes touch documented areas.",
        })
      }
    },
  }
}

export default DocsCheckPlugin
