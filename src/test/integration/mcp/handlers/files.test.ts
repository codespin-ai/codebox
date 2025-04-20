// src/test/integration/mcp/handlers/files.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFileHandlers } from "../../../../mcp/handlers/files.js";
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

describe("File Handlers with Sessions", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let writeFileHandler: RequestHandler;
  let openWorkspaceHandler: RequestHandler;
  let closeWorkspaceHandler: RequestHandler;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Register the project in the config
    createTestConfig(configDir, {
      projects: [
        {
          name: "test-workspace",
          hostPath: workspaceDir,
          dockerImage: "dummy-image",
        },
        {
          name: "copy-workspace",
          hostPath: workspaceDir,
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
        if (name === "write_file") {
          writeFileHandler = handler as RequestHandler;
        } else if (name === "open_workspace") {
          openWorkspaceHandler = handler as RequestHandler;
        } else if (name === "close_workspace") {
          closeWorkspaceHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerFileHandlers(server);
    registerProjectHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("write_file with sessions", function () {
    it("should write content to a file using a session", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write a file using the workspace token
      const response = await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "test.txt",
        content: "Hello, world!",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify the file was created
      const filePath = path.join(workspaceDir, "test.txt");
      expect(fs.existsSync(filePath)).to.equal(true);
      expect(fs.readFileSync(filePath, "utf8")).to.equal("Hello, world!");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should append content to a file using a session", async function () {
      // First create a file to append to
      const filePath = path.join(workspaceDir, "append.txt");
      fs.writeFileSync(filePath, "Initial content\n");

      // Open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Append to the file using the workspace token
      const response = await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "append.txt",
        content: "Appended content",
        mode: "append",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully appended");

      // Verify the file was updated
      expect(fs.readFileSync(filePath, "utf8")).to.equal(
        "Initial content\nAppended content"
      );

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should create directories as needed", async function () {
      // Open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write a file in a nested directory
      const response = await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "nested/dir/test.txt",
        content: "Nested content",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);

      // Verify the file was created
      const filePath = path.join(workspaceDir, "nested/dir/test.txt");
      expect(fs.existsSync(filePath)).to.equal(true);
      expect(fs.readFileSync(filePath, "utf8")).to.equal("Nested content");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should return error for invalid workspace tokens", async function () {
      const response = await writeFileHandler({
        workspaceToken: "invalid-session-id",
        filePath: "test.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired workspace token"
      );
    });

    it("should return error for invalid file paths", async function () {
      // Open a workspace
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Try to write to an invalid path
      const response = await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "../outside.txt",
        content: "This should fail",
        mode: "overwrite",
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid file path");

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });
  });

  describe("write_file with Copy Mode", function () {
    it("should write to a copy of the project and not modify original files", async function () {
      // Open a workspace with copy=true
      const openResponse = await openWorkspaceHandler({
        workspaceName: "copy-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write a file using the workspace token
      const response = await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "copied-file.txt",
        content: "This file should only exist in the copy",
        mode: "overwrite",
      });

      // Verify the response
      expect(response.isError).to.equal(undefined);
      expect(response.content[0].text).to.include("Successfully wrote file");

      // Verify the file was NOT created in the original project directory
      const filePath = path.join(workspaceDir, "copied-file.txt");
      expect(fs.existsSync(filePath)).to.equal(false);

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should allow multiple write operations in the same session", async function () {
      // Open a workspace with copy=true
      const openResponse = await openWorkspaceHandler({
        workspaceName: "copy-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write first file
      await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "multi-file1.txt",
        content: "First file content",
        mode: "overwrite",
      });

      // Write second file
      await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "multi-file2.txt",
        content: "Second file content",
        mode: "overwrite",
      });

      // Modify first file
      await writeFileHandler({
        workspaceToken: workspaceToken,
        filePath: "multi-file1.txt",
        content: " - Appended content",
        mode: "append",
      });

      // Neither file should exist in the original project directory
      expect(fs.existsSync(path.join(workspaceDir, "multi-file1.txt"))).to.equal(
        false
      );
      expect(fs.existsSync(path.join(workspaceDir, "multi-file2.txt"))).to.equal(
        false
      );

      // Clean up the workspace token
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });
  });
});
