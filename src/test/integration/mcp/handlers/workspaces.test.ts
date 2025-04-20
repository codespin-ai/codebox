// src/test/integration/mcp/handlers/workspaces.test.ts
import { expect } from "chai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceHandlers } from "../../../../mcp/handlers/workspaces.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";

// Response type for MCP tools
interface McpResponse {
  isError?: boolean;
  content: {
    type: string;
    text: string;
  }[];
}

// Mock request handler type
type RequestHandler = (args: Record<string, unknown>) => Promise<McpResponse>;

describe("Workspace Handlers", function () {
  let _testDir: string;
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let listWorkspacesHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    _testDir = env.testDir;
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "list_workspaces") {
          listWorkspacesHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerWorkspaceHandlers(server);
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("list_workspaces", function () {
    it("should return an empty list when no workspaces are registered", async function () {
      const response = await listWorkspacesHandler({});

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("No workspaces are registered");
    });

    it("should list all registered workspaces", async function () {
      // Register some workspaces in the config
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "workspace1",
            path: `${workspaceDir}/workspace1`,
            dockerImage: "image1",
          },
          {
            name: "workspace2",
            path: `${workspaceDir}/workspace2`,
            containerName: "container2",
          },
        ],
      });

      const response = await listWorkspacesHandler({});

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("workspace1");
      expect(response.content[0].text).to.include("workspace2");
    });
  });
});
