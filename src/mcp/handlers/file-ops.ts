// src/mcp/handlers/file-ops.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

// Format file size for display
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Format date for display
function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Register file operation handlers with the MCP server
 */
export function registerFileOpsHandlers(server: McpServer): void {
  // get_file_info - Get detailed file metadata
  server.tool(
    "get_file_info",
    "Get detailed metadata about a file or directory",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      filePath: zod.string().describe("Relative path to the file or directory"),
    },
    async ({ workspaceToken, filePath }) => {
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
            content: [{ type: "text" as const, text: `Error: Path not found: ${filePath}` }],
          };
        }

        const stats = fs.statSync(fullPath);

        const info: Record<string, string | number | boolean> = {
          path: filePath,
          absolutePath: fullPath,
          type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
          size: stats.size,
          sizeFormatted: formatSize(stats.size),
          created: formatDate(stats.birthtime),
          modified: formatDate(stats.mtime),
          accessed: formatDate(stats.atime),
          isReadable: true,
          isWritable: true,
        };

        // Check permissions
        try {
          fs.accessSync(fullPath, fs.constants.R_OK);
        } catch {
          info["isReadable"] = false;
        }

        try {
          fs.accessSync(fullPath, fs.constants.W_OK);
        } catch {
          info["isWritable"] = false;
        }

        // Add file-specific info
        if (stats.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          info["extension"] = ext || "(none)";
          info["basename"] = path.basename(filePath);

          // Count lines for text files
          if (
            [
              ".txt",
              ".md",
              ".ts",
              ".js",
              ".json",
              ".yaml",
              ".yml",
              ".html",
              ".css",
              ".py",
              ".java",
              ".c",
              ".cpp",
              ".h",
              ".go",
              ".rs",
              ".rb",
              ".php",
              ".sh",
              ".bash",
              ".zsh",
              ".xml",
              ".csv",
              ".sql",
              ".log",
              "",
            ].includes(ext)
          ) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              info["lineCount"] = content.split("\n").length;
            } catch {
              // Ignore if can't read as text
            }
          }
        }

        // Add directory-specific info
        if (stats.isDirectory()) {
          try {
            const entries = fs.readdirSync(fullPath);
            info["entryCount"] = entries.length;

            let fileCount = 0;
            let dirCount = 0;
            for (const entry of entries) {
              const entryPath = path.join(fullPath, entry);
              try {
                const entryStat = fs.statSync(entryPath);
                if (entryStat.isFile()) fileCount++;
                if (entryStat.isDirectory()) dirCount++;
              } catch {
                // Ignore stat errors
              }
            }
            info["fileCount"] = fileCount;
            info["directoryCount"] = dirCount;
          } catch {
            // Ignore if can't read directory
          }
        }

        // Format output
        const lines = Object.entries(info).map(([key, value]) => `${key}: ${value}`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
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

  // move_file - Move or rename a file/directory
  server.tool(
    "move_file",
    "Move or rename a file or directory",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      sourcePath: zod.string().describe("Relative path to the source file or directory"),
      destinationPath: zod.string().describe("Relative path to the destination"),
      overwrite: zod
        .boolean()
        .default(false)
        .describe("Overwrite destination if it exists (default: false)"),
    },
    async ({ workspaceToken, sourcePath, destinationPath, overwrite }) => {
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

      if (!validateFilePath(workingDir, sourcePath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid source path` }],
        };
      }

      if (!validateFilePath(workingDir, destinationPath)) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Invalid destination path` }],
        };
      }

      try {
        const sourceFullPath = path.join(workingDir, sourcePath);
        const destFullPath = path.join(workingDir, destinationPath);

        if (!fs.existsSync(sourceFullPath)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error: Source not found: ${sourcePath}` }],
          };
        }

        if (fs.existsSync(destFullPath) && !overwrite) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Destination already exists: ${destinationPath}. Use overwrite=true to replace.`,
              },
            ],
          };
        }

        // Ensure parent directory exists
        const destDir = path.dirname(destFullPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        // Perform the move
        fs.renameSync(sourceFullPath, destFullPath);

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully moved ${sourcePath} to ${destinationPath}`,
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

  // delete_file - Delete a file
  server.tool(
    "delete_file",
    "Delete a file",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      filePath: zod.string().describe("Relative path to the file to delete"),
    },
    async ({ workspaceToken, filePath }) => {
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
            content: [
              {
                type: "text" as const,
                text: `Error: Not a file: ${filePath}. Use delete_directory for directories.`,
              },
            ],
          };
        }

        fs.unlinkSync(fullPath);

        return {
          content: [{ type: "text" as const, text: `Successfully deleted file: ${filePath}` }],
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

  // delete_directory - Delete a directory
  server.tool(
    "delete_directory",
    "Delete a directory and its contents",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().describe("Relative path to the directory to delete"),
      recursive: zod
        .boolean()
        .default(false)
        .describe("Delete directory contents recursively (required for non-empty directories)"),
    },
    async ({ workspaceToken, dirPath, recursive }) => {
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

      // Prevent deleting the workspace root
      if (dirPath === "." || dirPath === "" || dirPath === "/") {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Error: Cannot delete workspace root` }],
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
            content: [
              {
                type: "text" as const,
                text: `Error: Not a directory: ${dirPath}. Use delete_file for files.`,
              },
            ],
          };
        }

        // Check if directory is empty
        const entries = fs.readdirSync(fullPath);
        if (entries.length > 0 && !recursive) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: Directory is not empty. Use recursive=true to delete non-empty directories.`,
              },
            ],
          };
        }

        fs.rmSync(fullPath, { recursive: true });

        return {
          content: [{ type: "text" as const, text: `Successfully deleted directory: ${dirPath}` }],
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
