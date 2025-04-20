// src/test/integration/mcp/handlers/execute.test.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { registerExecuteHandlers } from "../../../../mcp/handlers/execute.js";
import { registerWorkspaceHandlers } from "../../../../mcp/handlers/workspaces.js";
import { createTestConfig, setupTestEnvironment } from "../../setup.js";
import {
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  uniqueName,
} from "../../testUtils.js";

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

describe("Execute Handlers with Workspace tokens", function () {
  this.timeout(30000); // Docker operations can be slow

  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let executeCommandHandler: RequestHandler;
  let openWorkspaceHandler: RequestHandler;
  let closeWorkspaceHandler: RequestHandler;
  let dockerAvailable = false;
  let containerName: string;
  const workspaceName = "test-workspace";
  const dockerImage = "alpine:latest";

  before(async function () {
    // Check if Docker is available
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn("Docker not available. Docker tests will be skipped.");
    }
  });

  beforeEach(async function () {
    // Skip tests if Docker is not available
    if (!dockerAvailable) {
      this.skip();
      return;
    }

    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create unique name for container
    containerName = uniqueName("codebox-test-container");

    // Create a test file in the workspace directory
    createTestFile(
      path.join(workspaceDir, "test.txt"),
      "Hello from execute test!"
    );

    // Create a simple server to register handlers
    const server = {
      tool: (
        name: string,
        description: string,
        schema: object,
        handler: unknown
      ) => {
        if (name === "execute_command") {
          executeCommandHandler = handler as RequestHandler;
        } else if (name === "open_workspace") {
          openWorkspaceHandler = handler as RequestHandler;
        } else if (name === "close_workspace") {
          closeWorkspaceHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerExecuteHandlers(server);
    registerWorkspaceHandlers(server);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("execute_command with Container Mode", function () {
    beforeEach(async function () {
      // Create a test container
      await createTestContainer(containerName, dockerImage, workspaceDir);

      // Register the container in the config
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            hostPath: workspaceDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should execute a command in the container using a workspace token", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName,
      });

      const workspaceToken = openResponse.content[0].text;

      // Now execute command using the workspace token
      const response = await executeCommandHandler({
        workspaceToken: workspaceToken,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should handle command errors", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName,
      });

      const workspaceToken = openResponse.content[0].text;

      // Execute a command that will fail
      const response = await executeCommandHandler({
        workspaceToken: workspaceToken,
        command: "cat /nonexistent/file.txt",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("No such file");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should return error for invalidworkspace tokens", async function () {
      // Execute command with invalid workspace token
      const response = await executeCommandHandler({
        workspaceToken: "invalid-workspace-token-id",
        command: "echo 'This should fail'",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired workspace token"
      );
    });
  });

  describe("execute_command with Image Mode", function () {
    beforeEach(function () {
      // Register the image in the config
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            hostPath: workspaceDir,
            dockerImage,
          },
        ],
      });
    });

    it("should execute a command with the image using a workspace token", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName,
      });

      const workspaceToken = openResponse.content[0].text;

      // Now execute command using the workspace token
      const response = await executeCommandHandler({
        workspaceToken: workspaceToken,
        command: "cat /workspace/test.txt",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Hello from execute test!");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });
  });

  describe("execute_command with Copy Mode", function () {
    beforeEach(function () {
      // Register the image in the config with copy mode enabled
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            hostPath: workspaceDir,
            dockerImage,
            copy: true,
          },
        ],
      });

      // Create a file we'll try to modify
      const filePath = path.join(workspaceDir, "for-copy-test.txt");
      fs.writeFileSync(filePath, "This file should not change");
    });

    it("should execute commands with file copying without modifying originals", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName,
      });

      const workspaceToken = openResponse.content[0].text;

      // Execute a command that modifies a file
      const response = await executeCommandHandler({
        workspaceToken: workspaceToken,
        command:
          "echo 'Modified content' > /workspace/for-copy-test.txt && cat /workspace/for-copy-test.txt",
      });

      // Verify the command output shows the modified content
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Modified content");

      // But the original file should remain unchanged
      const filePath = path.join(workspaceDir, "for-copy-test.txt");
      expect(fs.readFileSync(filePath, "utf8")).to.equal(
        "This file should not change"
      );

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should maintain changes across multiple commands in the same workspace token", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName,
      });

      const workspaceToken = openResponse.content[0].text;

      // Execute a command that creates a file
      await executeCommandHandler({
        workspaceToken: workspaceToken,
        command: "echo 'First command' > /workspace/token-test.txt",
      });

      // Execute a second command that reads the file created by the first command
      const response = await executeCommandHandler({
        workspaceToken: workspaceToken,
        command: "cat /workspace/token-test.txt",
      });

      // Verify the second command can see the file created by the first
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("First command");

      // The file should not exist in the original workspace directory
      expect(fs.existsSync(path.join(workspaceDir, "token-test.txt"))).to.equal(
        false
      );

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });
  });
});
