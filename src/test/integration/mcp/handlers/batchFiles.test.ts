// src/test/integration/mcp/handlers/batchFiles.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBatchFileHandlers } from "../../../../mcp/handlers/batchFiles.js";
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

describe("Batch File Handlers with Sessions", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let writeBatchFilesHandler: RequestHandler;
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
        if (name === "write_batch_files") {
          writeBatchFilesHandler = handler as RequestHandler;
        } else if (name === "open_project_session") {
          openWorkspaceHandler = handler as RequestHandler;
        } else if (name === "close_project_session") {
          closeWorkspaceHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    // Register the handlers
    registerBatchFileHandlers(server);
    registerProjectHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("write_batch_files with sessions", function () {
    it("should write multiple files in a single operation using a session", async function () {
      // First, open a workspace
      const openResponse = await openWorkspaceHandler({
        projectName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write multiple files using the session
      const response = await writeBatchFilesHandler({
        workspaceToken: workspaceToken,
        files: [
          {
            filePath: "file1.txt",
            content: "Content for file 1",
            mode: "overwrite",
          },
          {
            filePath: "nested/file2.txt",
            content: "Content for file 2",
            mode: "overwrite",
          },
        ],
      });

      // Verify the response
      expect(response.isError || false).to.equal(false);
      expect(response.content[0].text).to.include("Success");

      // Verify files were created
      const file1Path = path.join(workspaceDir, "file1.txt");
      const file2Path = path.join(workspaceDir, "nested/file2.txt");

      expect(fs.existsSync(file1Path)).to.equal(true);
      expect(fs.existsSync(file2Path)).to.equal(true);

      expect(fs.readFileSync(file1Path, "utf8")).to.equal("Content for file 1");
      expect(fs.readFileSync(file2Path, "utf8")).to.equal("Content for file 2");

      // Clean up the session
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should stop on first error if stopOnError is true", async function () {
      // First create a file we can append to
      const validFilePath = path.join(workspaceDir, "valid.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      // Open a workspace
      const openResponse = await openWorkspaceHandler({
        projectName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Try to write files with one invalid path
      const response = await writeBatchFilesHandler({
        workspaceToken: workspaceToken,
        files: [
          {
            filePath: "../outside.txt", // Invalid path
            content: "This should fail",
            mode: "overwrite",
          },
          {
            filePath: "valid.txt",
            content: "Appended content",
            mode: "append",
          },
        ],
        stopOnError: true,
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include("Invalid file path");

      // Second operation should not have happened
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "Initial content\n"
      );

      // Clean up the session
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should continue after errors if stopOnError is false", async function () {
      // First create a file we can append to
      const validFilePath = path.join(workspaceDir, "valid2.txt");
      fs.writeFileSync(validFilePath, "Initial content\n");

      // Open a workspace
      const openResponse = await openWorkspaceHandler({
        projectName: "test-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Try to write files with one invalid path but continue
      const response = await writeBatchFilesHandler({
        workspaceToken: workspaceToken,
        files: [
          {
            filePath: "../outside.txt", // Invalid path
            content: "This should fail",
            mode: "overwrite",
          },
          {
            filePath: "valid2.txt",
            content: "Appended content",
            mode: "append",
          },
        ],
        stopOnError: false,
      });

      // Response should indicate partial success
      expect(response.content[0].text).to.include("Failed");
      expect(response.content[0].text).to.include("Success");

      // Second operation should have happened
      expect(fs.readFileSync(validFilePath, "utf8")).to.equal(
        "Initial content\nAppended content"
      );

      // Clean up the session
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });

    it("should return error for invalid sessions", async function () {
      const response = await writeBatchFilesHandler({
        workspaceToken: "invalid-session-id",
        files: [
          {
            filePath: "file.txt",
            content: "This should fail",
            mode: "overwrite",
          },
        ],
      });

      // Verify the error response
      expect(response.isError).to.equal(true);
      expect(response.content[0].text).to.include(
        "Invalid or expired workspace token"
      );
    });
  });

  describe("write_batch_files with Copy Mode", function () {
    it("should write multiple files to a copy without modifying original files", async function () {
      // Open a workspace with copy=true
      const openResponse = await openWorkspaceHandler({
        projectName: "copy-workspace",
      });

      const workspaceToken = openResponse.content[0].text;

      // Write multiple files using the session
      const response = await writeBatchFilesHandler({
        workspaceToken: workspaceToken,
        files: [
          {
            filePath: "batch-copy1.txt",
            content: "Content for file 1",
            mode: "overwrite",
          },
          {
            filePath: "batch-copy2.txt",
            content: "Content for file 2",
            mode: "overwrite",
          },
        ],
      });

      // Verify the response
      expect(response.isError || false).to.equal(false);
      expect(response.content[0].text).to.include("Success");

      // Verify files were NOT created in the original project directory
      const file1Path = path.join(workspaceDir, "batch-copy1.txt");
      const file2Path = path.join(workspaceDir, "batch-copy2.txt");

      expect(fs.existsSync(file1Path)).to.equal(false);
      expect(fs.existsSync(file2Path)).to.equal(false);

      // Clean up the session
      await closeWorkspaceHandler({
        workspaceToken: workspaceToken,
      });
    });
  });
});
