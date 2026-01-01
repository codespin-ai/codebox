// src/mcp/handlers/replace.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register replace handlers with the MCP server
 */
export function registerReplaceHandlers(server: McpServer): void {
  // replace_content - Replace literal string content in a file
  server.tool(
    "replace_content",
    "Replace literal string content in a file",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      filePath: zod.string().describe("Relative path to the file"),
      oldContent: zod.string().describe("The exact content to find and replace"),
      newContent: zod.string().describe("The content to replace with"),
      replaceAll: zod
        .boolean()
        .default(false)
        .describe("Replace all occurrences (default: false, replaces first only)"),
    },
    async ({ workspaceToken, filePath, oldContent, newContent, replaceAll }) => {
      if (!workspaceTokenExists(workspaceToken)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid workspace token` }],
        };
      }

      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);
      if (!workingDir) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Workspace not found` }],
        };
      }

      if (!validateFilePath(workingDir, filePath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, filePath);

        if (!fs.existsSync(fullPath)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: File not found: ${filePath}` }],
          };
        }

        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Not a file: ${filePath}` }],
          };
        }

        const content = fs.readFileSync(fullPath, "utf-8");

        // Check if oldContent exists
        if (!content.includes(oldContent)) {
          return {
            isError: true,
            content: [
              { type: "text" as const, text: `Error: Content to replace not found in file` },
            ],
          };
        }

        // Count occurrences
        let occurrences = 0;
        let pos = 0;
        while ((pos = content.indexOf(oldContent, pos)) !== -1) {
          occurrences++;
          pos += oldContent.length;
        }

        // Perform replacement
        let newFileContent: string;
        let replacedCount: number;

        if (replaceAll) {
          // Replace all occurrences
          newFileContent = content.split(oldContent).join(newContent);
          replacedCount = occurrences;
        } else {
          // Replace first occurrence only
          newFileContent = content.replace(oldContent, newContent);
          replacedCount = 1;
        }

        fs.writeFileSync(fullPath, newFileContent, "utf-8");

        const message =
          replaceAll && occurrences > 1
            ? `Replaced ${replacedCount} occurrence(s) in ${filePath}`
            : `Replaced content in ${filePath}`;

        return {
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // replace_content_regex - Replace content using regex pattern
  server.tool(
    "replace_content_regex",
    "Replace content in a file using regex pattern",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      filePath: zod.string().describe("Relative path to the file"),
      pattern: zod.string().describe("Regex pattern to match"),
      replacement: zod
        .string()
        .describe("Replacement string (can use $1, $2, etc. for capture groups)"),
      flags: zod
        .string()
        .default("g")
        .describe("Regex flags (default: 'g' for global, use 'gi' for case-insensitive)"),
    },
    async ({ workspaceToken, filePath, pattern, replacement, flags }) => {
      if (!workspaceTokenExists(workspaceToken)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid workspace token` }],
        };
      }

      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);
      if (!workingDir) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Workspace not found` }],
        };
      }

      if (!validateFilePath(workingDir, filePath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, filePath);

        if (!fs.existsSync(fullPath)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: File not found: ${filePath}` }],
          };
        }

        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Not a file: ${filePath}` }],
          };
        }

        const content = fs.readFileSync(fullPath, "utf-8");

        // Create regex
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, flags);
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Invalid regex pattern: ${e instanceof Error ? e.message : "Unknown error"}`,
              },
            ],
          };
        }

        // Check for matches
        const matches = content.match(regex);
        if (!matches || matches.length === 0) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Pattern not found in file` }],
          };
        }

        // Perform replacement
        const newFileContent = content.replace(regex, replacement);
        const matchCount = matches.length;

        fs.writeFileSync(fullPath, newFileContent, "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: `Replaced ${matchCount} match(es) in ${filePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );
}
