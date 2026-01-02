// src/test/integration/mcp/logging.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import {
  wrapToolHandler,
  addLoggingToServer,
  createLoggingEnabledServer,
} from "../../../mcp/logging.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setupTestEnvironment, createTestConfig } from "../setup.js";

describe("MCP Logging", () => {
  describe("wrapToolHandler", () => {
    it("should wrap a handler and call it correctly", async () => {
      let called = false;
      let receivedArgs: Record<string, unknown> = {};

      const originalHandler = async (args: Record<string, unknown>) => {
        called = true;
        receivedArgs = args;
        return {
          content: [{ type: "text" as const, text: "success" }],
        };
      };

      const wrappedHandler = wrapToolHandler("test_tool", originalHandler);
      const result = await wrappedHandler({ foo: "bar" }, {} as never);

      expect(called).to.be.true;
      expect(receivedArgs).to.deep.equal({ foo: "bar" });
      const firstContent = result.content[0];
      expect(firstContent.type).to.equal("text");
      if (firstContent.type === "text") {
        expect(firstContent.text).to.equal("success");
      }
    });

    it("should pass through errors from the handler", async () => {
      const originalHandler = async () => {
        throw new Error("test error");
      };

      const wrappedHandler = wrapToolHandler("test_tool", originalHandler);

      try {
        await wrappedHandler({}, {} as never);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as Error).message).to.equal("test error");
      }
    });

    it("should return the same result as the original handler", async () => {
      const expectedResult = {
        content: [{ type: "text" as const, text: "hello world" }],
        isError: false,
      };

      const originalHandler = async () => expectedResult;
      const wrappedHandler = wrapToolHandler("test_tool", originalHandler);

      const result = await wrappedHandler({}, {} as never);
      expect(result).to.deep.equal(expectedResult);
    });
  });

  describe("addLoggingToServer", () => {
    it("should wrap the server.tool method", () => {
      const registeredTools: string[] = [];

      const mockServer = {
        tool: function (name: string) {
          registeredTools.push(name);
        },
      } as unknown as McpServer;

      const wrappedServer = addLoggingToServer(mockServer);

      // Call the wrapped tool method
      (wrappedServer.tool as unknown as (name: string, handler: () => void) => void)(
        "test_tool",
        () => {}
      );

      expect(registeredTools).to.include("test_tool");
    });

    it("should return the same server instance", () => {
      const mockServer = {
        tool: () => {},
      } as unknown as McpServer;

      const wrappedServer = addLoggingToServer(mockServer);
      expect(wrappedServer).to.equal(mockServer);
    });
  });

  describe("createLoggingEnabledServer", () => {
    let testEnv: ReturnType<typeof setupTestEnvironment>;

    beforeEach(() => {
      testEnv = setupTestEnvironment();
    });

    afterEach(() => {
      testEnv.cleanup();
    });

    it("should return server with logging when debug is enabled", () => {
      createTestConfig(testEnv.configDir, {
        debug: true,
        workspaces: [],
      });

      const mockServer = {
        tool: () => {},
      } as unknown as McpServer;

      const result = createLoggingEnabledServer(mockServer);

      // The server should have its tool method wrapped
      expect(result).to.equal(mockServer);
    });

    it("should return server without logging when debug is disabled", () => {
      createTestConfig(testEnv.configDir, {
        debug: false,
        workspaces: [],
      });

      const mockServer = {
        tool: () => {},
      } as unknown as McpServer;

      const result = createLoggingEnabledServer(mockServer);
      expect(result).to.equal(mockServer);
    });

    it("should return server without logging when no config exists", () => {
      // Don't create a config file

      const mockServer = {
        tool: () => {},
      } as unknown as McpServer;

      const result = createLoggingEnabledServer(mockServer);
      expect(result).to.equal(mockServer);
    });
  });
});
