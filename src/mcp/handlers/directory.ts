// src/mcp/handlers/directory.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";
import { createGitignoreFilter, shouldIgnore } from "../../fs/gitignore.js";
import { truncateContent, formatTruncationInfo } from "../../fs/truncation.js";

// Format file size for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * Register directory handlers with the MCP server
 */
export function registerDirectoryHandlers(server: McpServer): void {
  // list_directory - List files and directories
  server.tool(
    "list_directory",
    "List files and directories in a workspace path",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().default(".").describe("Relative path to directory (default: root)"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum response size in KB"),
      respectGitignore: zod
        .boolean()
        .default(true)
        .describe("Filter out files matching .gitignore patterns (default: true)"),
    },
    async ({ workspaceToken, dirPath, maxResponseSizeKb, respectGitignore }) => {
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

      if (!validateFilePath(workingDir, dirPath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, dirPath);

        if (!fs.existsSync(fullPath)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Directory not found: ${dirPath}` }],
          };
        }

        const stats = fs.statSync(fullPath);
        if (!stats.isDirectory()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Not a directory: ${dirPath}` }],
          };
        }

        const ig = respectGitignore ? createGitignoreFilter(workingDir) : null;
        // Always ignore .git directory
        if (ig) ig.add(".git");

        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const lines: string[] = [];

        for (const entry of entries) {
          const relativePath = path.join(dirPath, entry.name);
          if (shouldIgnore(relativePath, ig, respectGitignore)) continue;

          const prefix = entry.isDirectory() ? "[DIR]" : "[FILE]";
          lines.push(`${prefix} ${entry.name}`);
        }

        let content = lines.length > 0 ? lines.join("\n") : "(empty directory)";
        const truncResult = truncateContent(content, maxResponseSizeKb);
        content = truncResult.content + formatTruncationInfo(truncResult);

        return {
          content: [{ type: "text" as const, text: content }],
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

  // list_directory_with_sizes - List with file sizes
  server.tool(
    "list_directory_with_sizes",
    "List files and directories with sizes",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().default(".").describe("Relative path to directory"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum response size in KB"),
      respectGitignore: zod.boolean().default(true).describe("Filter gitignored files"),
      sortBy: zod.enum(["name", "size"]).default("name").describe("Sort by name or size"),
    },
    async ({ workspaceToken, dirPath, maxResponseSizeKb, respectGitignore, sortBy }) => {
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

      if (!validateFilePath(workingDir, dirPath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, dirPath);

        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Directory not found` }],
          };
        }

        const ig = respectGitignore ? createGitignoreFilter(workingDir) : null;
        if (ig) ig.add(".git");

        const entries = fs.readdirSync(fullPath, { withFileTypes: true });
        const items: Array<{ name: string; isDir: boolean; size: number }> = [];

        for (const entry of entries) {
          const relativePath = path.join(dirPath, entry.name);
          if (shouldIgnore(relativePath, ig, respectGitignore)) continue;

          const entryPath = path.join(fullPath, entry.name);
          let size = 0;
          try {
            const stat = fs.statSync(entryPath);
            size = stat.size;
          } catch {
            // Ignore stat errors
          }

          items.push({ name: entry.name, isDir: entry.isDirectory(), size });
        }

        // Sort
        items.sort((a, b) => {
          if (sortBy === "size") return b.size - a.size;
          return a.name.localeCompare(b.name);
        });

        const lines = items.map((item) => {
          const prefix = item.isDir ? "[DIR]" : "[FILE]";
          const sizeStr = item.isDir ? "" : formatSize(item.size).padStart(10);
          return `${prefix} ${item.name.padEnd(30)} ${sizeStr}`;
        });

        // Summary
        const totalFiles = items.filter((i) => !i.isDir).length;
        const totalDirs = items.filter((i) => i.isDir).length;
        const totalSize = items.reduce((sum, i) => sum + (i.isDir ? 0 : i.size), 0);

        lines.push("");
        lines.push(`Total: ${totalFiles} files, ${totalDirs} directories`);
        lines.push(`Combined size: ${formatSize(totalSize)}`);

        let content = lines.join("\n");
        const truncResult = truncateContent(content, maxResponseSizeKb);
        content = truncResult.content + formatTruncationInfo(truncResult);

        return {
          content: [{ type: "text" as const, text: content }],
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

  // directory_tree - Recursive tree view
  server.tool(
    "directory_tree",
    "Get a recursive tree view of files and directories as JSON",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().default(".").describe("Relative path to directory"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum response size in KB"),
      respectGitignore: zod.boolean().default(true).describe("Filter gitignored files"),
      excludePatterns: zod
        .array(zod.string())
        .default([])
        .describe("Additional patterns to exclude"),
    },
    async ({ workspaceToken, dirPath, maxResponseSizeKb, respectGitignore, excludePatterns }) => {
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

      if (!validateFilePath(workingDir, dirPath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, dirPath);
        // Capture workingDir for use in nested function (TypeScript narrowing doesn't work in closures)
        const baseDir = workingDir;

        if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Directory not found` }],
          };
        }

        const ig = respectGitignore ? createGitignoreFilter(baseDir) : null;
        if (ig) {
          ig.add(".git");
          for (const pattern of excludePatterns) {
            ig.add(pattern);
          }
        }

        type TreeEntry = {
          name: string;
          type: "file" | "directory";
          children?: TreeEntry[];
        };

        function buildTree(currentPath: string, relativeTo: string): TreeEntry[] {
          const entries = fs.readdirSync(currentPath, { withFileTypes: true });
          const result: TreeEntry[] = [];

          for (const entry of entries) {
            const relPath = path.relative(baseDir, path.join(currentPath, entry.name));
            if (shouldIgnore(relPath, ig, respectGitignore)) continue;

            const treeEntry: TreeEntry = {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
            };

            if (entry.isDirectory()) {
              treeEntry.children = buildTree(path.join(currentPath, entry.name), relativeTo);
            }

            result.push(treeEntry);
          }

          return result;
        }

        const tree = buildTree(fullPath, baseDir);
        let content = JSON.stringify(tree, null, 2);

        const truncResult = truncateContent(content, maxResponseSizeKb);
        content = truncResult.content + formatTruncationInfo(truncResult);

        return {
          content: [{ type: "text" as const, text: content }],
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

  // create_directory - Create a new directory
  server.tool(
    "create_directory",
    "Create a new directory in the workspace",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().describe("Relative path of directory to create"),
    },
    async ({ workspaceToken, dirPath }) => {
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

      if (!validateFilePath(workingDir, dirPath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid path` }],
        };
      }

      try {
        const fullPath = path.join(workingDir, dirPath);
        fs.mkdirSync(fullPath, { recursive: true });

        return {
          content: [{ type: "text" as const, text: `Successfully created directory: ${dirPath}` }],
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
