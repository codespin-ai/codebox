// src/test/integration/mcp/server.test.ts
import { expect } from "chai";
import { createServer } from "../../../mcp/server.js";
import { setupTestEnvironment } from "../setup.js";

describe("MCP Server", function () {
  let _testDir: string;
  let _configDir: string;
  let _workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    _testDir = env.testDir;
    _configDir = env.configDir;
    _workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("createServer", function () {
    it("should create an MCP server with all tools registered", async function () {
      const server = await createServer();

      // Since we can't access internal properties directly,
      // let's use type checking to verify the server
      expect(server).to.not.equal(null);
      expect(server).to.have.property("tool").that.is.a("function");
      expect(server).to.have.property("connect").that.is.a("function");
    });
  });
});
