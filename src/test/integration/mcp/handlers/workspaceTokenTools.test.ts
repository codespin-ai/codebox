// src/test/integration/mcp/handlers/workspaceTokenTools.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerWorkspaceHandlers } from "../../../../mcp/handlers/workspaces.js";
import { createTestConfig, setupTestEnvironment } from "../../setup.js";
import { createTestFile } from "../../testUtils.js";
import { getWorkingDirForWorkspaceToken } from "../../../../workspaceTokens/workspaceTokenStore.js";

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

describe("Workspace token based Tools", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let openWorkspaceHandler: RequestHandler;
  let closeWorkspaceHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create a test file in the workspace directory
    createTestFile(path.join(workspaceDir, "test.txt"), "Test content");

    // Register a workspace
    createTestConfig(configDir, {
      workspaces: [
        {
          name: "test-workspace",
          path: workspaceDir,
          dockerImage: "dummy-image",
          copy: false,
        },
        {
          name: "copy-workspace",
          path: workspaceDir,
          dockerImage: "dummy-image",
          copy: true,
        },
      ],
    });

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "open_workspace") {
          openWorkspaceHandler = handler as RequestHandler;
        } else if (name === "close_workspace") {
          closeWorkspaceHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerWorkspaceHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("open_workspace", function () {
    it("should open a workspace token for a valid workspace", async function () {
      const response = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.be.a("string");
      expect(response.content[0].text).to.not.equal(undefined);
      expect(response.content[0].text).to.not.equal(null);
    });

    it("should return an error for invalid workspaces", async function () {
      const response = await openWorkspaceHandler({
        workspaceName: "non-existent-workspace",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered workspace"
      );
    });
  });

  describe("close_workspace", function () {
    it("should close a valid workspace token", async function () {
      // First open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      // Then close it
      const closeResponse = await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });

      // Verify the response
      expect(closeResponse.isError).to.equal(undefined);
      expect(closeResponse.content[0].text).to.include("Workspace token closed");
    });

    it("should return an error for invalid workspace tokens", async function () {
      const response = await closeWorkspaceHandler({
        workspaceToken: "non-existent-workspace-token",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid workspace token");
    });
  });

  describe("Copy Mode Behavior", function () {
    it("should create temporary files when opening a workspace token with copy=true", async function () {
      // Open a workspace token for a workspace with copy=true
      const response = await openWorkspaceHandler({
        workspaceName: "copy-workspace",
      });

      const workspaceToken = response.content[0].text;

      // Get the working directory from the workspace token
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);

      // Verify the working directory exists and is not the original workspace directory
      expect(workingDir).to.not.equal(workspaceDir);
      expect(fs.existsSync(workingDir as string)).to.equal(true);

      // Verify the test file was copied to the working directory
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.equal("Test content");

      // Close the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });

      // Verify the working directory was cleaned up
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });
  });
});
