// src/test/integration/mcp/handlers/projects.test.ts
import { expect } from "chai";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/workspaces.js";
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
  let listProjectsHandler: RequestHandler;

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
        if (name === "list_projects") {
          listProjectsHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerProjectHandlers(server);
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("list_projects", function () {
    it("should return an empty list when no projects are registered", async function () {
      const response = await listProjectsHandler({});

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("No projects are registered");
    });

    it("should list all registered projects", async function () {
      // Register some projects in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: "project1",
            hostPath: `${workspaceDir}/project1`,
            dockerImage: "image1",
          },
          {
            name: "project2",
            hostPath: `${workspaceDir}/project2`,
            containerName: "container2",
          },
        ],
      });

      const response = await listProjectsHandler({});

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("project1");
      expect(response.content[0].text).to.include("project2");
    });
  });
});
