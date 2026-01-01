// src/test/integration/mcp/handlers/directory.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import * as fs from "fs";
import * as path from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDirectoryHandlers } from "../../../../mcp/handlers/directory.js";
import { registerWorkspaceHandlers } from "../../../../mcp/handlers/workspaces.js";
import { setupTestEnvironment, createTestConfig } from "../../setup.js";

// Response type for MCP tools
type McpResponse = {
  isError?: boolean;
  content: {
    type: string;
    text: string;
  }[];
};

// Mock request handler type
type RequestHandler = (args: Record<string, unknown>) => Promise<McpResponse>;

describe("Directory Handlers", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let listDirectoryHandler: RequestHandler;
  let directoryTreeHandler: RequestHandler;
  let createDirectoryHandler: RequestHandler;
  let openWorkspaceHandler: RequestHandler;
  let closeWorkspaceHandler: RequestHandler;

  beforeEach(function () {
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    createTestConfig(configDir, {
      workspaces: [
        {
          name: "test-workspace",
          path: workspaceDir,
          image: "dummy-image",
        },
      ],
    });

    // Create test directory structure
    fs.mkdirSync(path.join(workspaceDir, "subdir"));
    fs.writeFileSync(path.join(workspaceDir, "file1.txt"), "content1");
    fs.writeFileSync(path.join(workspaceDir, "file2.txt"), "content2");
    fs.writeFileSync(path.join(workspaceDir, "subdir", "nested.txt"), "nested");

    const server = {
      tool: (name: string, _description: string, _schema: object, handler: unknown) => {
        if (name === "list_directory") {
          listDirectoryHandler = handler as RequestHandler;
        } else if (name === "directory_tree") {
          directoryTreeHandler = handler as RequestHandler;
        } else if (name === "create_directory") {
          createDirectoryHandler = handler as RequestHandler;
        } else if (name === "open_workspace") {
          openWorkspaceHandler = handler as RequestHandler;
        } else if (name === "close_workspace") {
          closeWorkspaceHandler = handler as RequestHandler;
        }
      },
    } as unknown as McpServer;

    registerDirectoryHandlers(server);
    registerWorkspaceHandlers(server);
  });

  afterEach(function () {
    cleanup();
  });

  describe("list_directory", function () {
    it("should list directory contents", async function () {
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      const result = await listDirectoryHandler({
        workspaceToken,
        dirPath: ".",
        maxResponseSizeKb: 100,
        respectGitignore: false,
      });

      expect(result.isError).to.be.undefined;
      expect(result.content[0].text).to.include("[FILE] file1.txt");
      expect(result.content[0].text).to.include("[DIR] subdir");

      await closeWorkspaceHandler({ workspaceToken });
    });

    it("should respect gitignore", async function () {
      fs.writeFileSync(path.join(workspaceDir, ".gitignore"), "*.log\n");
      fs.writeFileSync(path.join(workspaceDir, "debug.log"), "log content");

      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      const result = await listDirectoryHandler({
        workspaceToken,
        dirPath: ".",
        maxResponseSizeKb: 100,
        respectGitignore: true,
      });

      expect(result.content[0].text).to.not.include("debug.log");
      expect(result.content[0].text).to.include("file1.txt");

      await closeWorkspaceHandler({ workspaceToken });
    });
  });

  describe("directory_tree", function () {
    it("should return JSON tree structure", async function () {
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      const result = await directoryTreeHandler({
        workspaceToken,
        dirPath: ".",
        maxResponseSizeKb: 100,
        respectGitignore: false,
        excludePatterns: [],
      });

      expect(result.isError).to.be.undefined;
      const tree = JSON.parse(result.content[0].text);
      expect(tree).to.be.an("array");

      const subdir = tree.find((e: { name: string }) => e.name === "subdir");
      expect(subdir).to.not.be.undefined;
      expect(subdir.type).to.equal("directory");

      await closeWorkspaceHandler({ workspaceToken });
    });
  });

  describe("create_directory", function () {
    it("should create a new directory", async function () {
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      const result = await createDirectoryHandler({
        workspaceToken,
        dirPath: "new-dir",
      });

      expect(result.isError).to.be.undefined;
      expect(result.content[0].text).to.include("Successfully created");
      expect(fs.existsSync(path.join(workspaceDir, "new-dir"))).to.be.true;

      await closeWorkspaceHandler({ workspaceToken });
    });

    it("should create nested directories", async function () {
      const openResponse = await openWorkspaceHandler({
        workspaceName: "test-workspace",
      });
      const workspaceToken = openResponse.content[0].text;

      const result = await createDirectoryHandler({
        workspaceToken,
        dirPath: "a/b/c",
      });

      expect(result.isError).to.be.undefined;
      expect(fs.existsSync(path.join(workspaceDir, "a/b/c"))).to.be.true;

      await closeWorkspaceHandler({ workspaceToken });
    });
  });
});
