// src/test/integration/mcp/handlers/sessionTools.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectHandlers } from "../../../../mcp/handlers/workspaces.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";
import { createTestFile } from "../../testUtils.js";
import { getWorkingDirForSession } from "../../../../workspaceTokens/workspaceTokenStore.js";

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

describe("Session-Based Tools", function () {
  let configDir: string;
  let projectDir: string;
  let cleanup: () => void;
  let openProjectSessionHandler: RequestHandler;
  let closeProjectSessionHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;

    // Create a test file in the project directory
    createTestFile(path.join(projectDir, "test.txt"), "Test content");

    // Register a project
    createTestConfig(configDir, {
      projects: [
        {
          name: "test-project",
          hostPath: projectDir,
          dockerImage: "dummy-image",
          copy: false,
        },
        {
          name: "copy-project",
          hostPath: projectDir,
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
        if (name === "open_project_session") {
          openProjectSessionHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeProjectSessionHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerProjectHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("open_project_session", function () {
    it("should open a session for a valid project", async function () {
      const response = await openProjectSessionHandler({
        projectName: "test-project",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.be.a("string");
      expect(response.content[0].text).to.not.equal(undefined);
      expect(response.content[0].text).to.not.equal(null);
    });

    it("should return an error for invalid projects", async function () {
      const response = await openProjectSessionHandler({
        projectName: "non-existent-project",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or unregistered project"
      );
    });
  });

  describe("close_project_session", function () {
    it("should close a valid session", async function () {
      // First open a session
      const openResponse = await openProjectSessionHandler({
        projectName: "test-project",
      });
      const sessionId = openResponse.content[0].text;

      // Then close it
      const closeResponse = await closeProjectSessionHandler({
        projectSessionId: sessionId,
      });

      // Verify the response
      expect(closeResponse.isError).to.equal(undefined);
      expect(closeResponse.content[0].text).to.include("Session closed");
    });

    it("should return an error for invalid session IDs", async function () {
      const response = await closeProjectSessionHandler({
        projectSessionId: "non-existent-session",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid session ID");
    });
  });

  describe("Copy Mode Behavior", function () {
    it("should create temporary files when opening a session with copy=true", async function () {
      // Open a session for a project with copy=true
      const response = await openProjectSessionHandler({
        projectName: "copy-project",
      });

      const sessionId = response.content[0].text;

      // Get the working directory from the session
      const workingDir = getWorkingDirForSession(sessionId);

      // Verify the working directory exists and is not the original project directory
      expect(workingDir).to.not.equal(projectDir);
      expect(fs.existsSync(workingDir as string)).to.equal(true);

      // Verify the test file was copied to the working directory
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.equal("Test content");

      // Close the session
      await closeProjectSessionHandler({
        projectSessionId: sessionId,
      });

      // Verify the working directory was cleaned up
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });
  });
});
