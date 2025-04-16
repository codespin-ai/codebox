// src/mcp/tools/execute.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  validateProject,
  executeInContainer,
} from "../utils.js";

export function registerExecuteTools(server: McpServer): void {
  server.tool(
    "execute_command",
    "Execute a command in a Docker container for a specific project",
    {
      command: zod.string().describe("The command to execute in the container"),
      projectDir: zod
        .string()
        .describe("The absolute path to the project directory"),
    },
    async ({ command, projectDir }) => {
      if (!validateProject(projectDir)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or unregistered project directory: ${projectDir}`,
            },
          ],
        };
      }

      try {
        const { stdout, stderr } = await executeInContainer(
          projectDir,
          command
        );
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing command: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}