// src/mcp/handlers/search.ts
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
import type { Ignore } from "ignore";

type SearchMatch = {
  file: string;
  line: number;
  content: string;
};

// Recursively find all files in a directory
function findFiles(
  dir: string,
  workingDir: string,
  ig: Ignore | null,
  respectGitignore: boolean,
  pattern: RegExp | null
): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(workingDir, fullPath);

      // Skip ignored files
      if (shouldIgnore(relativePath, ig, respectGitignore)) continue;

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        results.push(...findFiles(fullPath, workingDir, ig, respectGitignore, pattern));
      } else if (entry.isFile()) {
        // Check if filename matches pattern (if provided)
        if (!pattern || pattern.test(entry.name)) {
          results.push(relativePath);
        }
      }
    }
  } catch {
    // Ignore permission errors and continue
  }

  return results;
}

// Search for content within a file
function searchInFile(filePath: string, pattern: RegExp, maxMatches: number): SearchMatch[] {
  const matches: SearchMatch[] = [];

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const line = lines[i];
      if (line !== undefined && pattern.test(line)) {
        matches.push({
          file: filePath,
          line: i + 1,
          content: line.length > 200 ? line.slice(0, 200) + "..." : line,
        });
      }
    }
  } catch {
    // Ignore read errors
  }

  return matches;
}

/**
 * Register search handlers with the MCP server
 */
export function registerSearchHandlers(server: McpServer): void {
  // search_files - Search for files and content
  server.tool(
    "search_files",
    "Search for files by name pattern and/or content pattern",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      dirPath: zod.string().default(".").describe("Relative path to directory to search in"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum response size in KB"),
      respectGitignore: zod.boolean().default(true).describe("Filter gitignored files"),
      filePattern: zod
        .string()
        .optional()
        .describe("Regex pattern to match file names (e.g., '\\.ts$' for TypeScript files)"),
      contentPattern: zod.string().optional().describe("Regex pattern to search within files"),
      caseSensitive: zod.boolean().default(true).describe("Case sensitive search"),
      maxResults: zod
        .number()
        .int()
        .positive()
        .default(100)
        .describe("Maximum number of results to return"),
    },
    async ({
      workspaceToken,
      dirPath,
      maxResponseSizeKb,
      respectGitignore,
      filePattern,
      contentPattern,
      caseSensitive,
      maxResults,
    }) => {
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

      // At least one pattern must be provided
      if (!filePattern && !contentPattern) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: At least one of filePattern or contentPattern must be provided`,
            },
          ],
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

        const regexFlags = caseSensitive ? "" : "i";
        const fileRegex = filePattern ? new RegExp(filePattern, regexFlags) : null;
        const contentRegex = contentPattern ? new RegExp(contentPattern, regexFlags) : null;

        // Find matching files
        const files = findFiles(fullPath, workingDir, ig, respectGitignore, fileRegex);

        const lines: string[] = [];
        let resultCount = 0;

        if (contentRegex) {
          // Search within files for content
          for (const file of files) {
            if (resultCount >= maxResults) break;

            const fileFull = path.join(workingDir, file);
            const matches = searchInFile(fileFull, contentRegex, maxResults - resultCount);

            for (const match of matches) {
              lines.push(`${file}:${match.line}: ${match.content}`);
              resultCount++;
            }
          }

          if (lines.length === 0) {
            lines.push("No content matches found");
          } else {
            lines.unshift(`Found ${resultCount} match(es) in content:\n`);
          }
        } else {
          // Just list matching files
          const limitedFiles = files.slice(0, maxResults);
          resultCount = limitedFiles.length;

          if (limitedFiles.length === 0) {
            lines.push("No matching files found");
          } else {
            lines.push(`Found ${files.length} file(s):\n`);
            lines.push(...limitedFiles);

            if (files.length > maxResults) {
              lines.push(`\n... and ${files.length - maxResults} more files`);
            }
          }
        }

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
}
