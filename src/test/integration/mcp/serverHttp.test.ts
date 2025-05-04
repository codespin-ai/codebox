// src/test/integration/mcp/serverHttp.test.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect } from "chai";
import * as http from "http";
import * as path from "path";
import { startHttpServer } from "../../../mcp/serverHttp.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import {
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  uniqueName,
} from "../testUtils.js";
import { Socket } from "net";

// Define the tool response type for proper typing
interface ToolResponse {
  content: {
    type: string;
    text: string;
  }[];
  isError?: boolean;
}

describe("MCP HTTP Server Integration Tests", function () {
  this.timeout(30000); // HTTP operations + Docker can be slow

  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let httpServer: http.Server;
  let port: number;
  let baseUrl: string;
  let client: Client;
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

  // Helper to start the HTTP server on a random port
  async function startTestServer(): Promise<number> {
    // Find a random available port
    const getRandomPort = () => Math.floor(Math.random() * 10000) + 30000;
    port = getRandomPort();
    baseUrl = `http://localhost:${port}/mcp`;

    // Start HTTP server and store the reference
    httpServer = await startHttpServer({
      host: "localhost",
      port: port,
    });

    return port;
  }

  // Helper to safely close an HTTP server with timeout
  async function closeHttpServer(
    server: http.Server,
    timeoutMs = 5000
  ): Promise<void> {
    if (!server) return;

    // Get all active connections
    const connections: Record<string, Socket> = {};
    server.on("connection", (conn) => {
      const key = conn.remoteAddress + ":" + conn.remotePort;
      connections[key] = conn;
      conn.on("close", () => {
        delete connections[key];
      });
    });

    return new Promise<void>((resolve) => {
      // Set a timeout to force close if taking too long
      const timeout = setTimeout(() => {
        console.warn("Force closing HTTP server after timeout");
        // Destroy all remaining connections
        Object.values(connections).forEach((conn) => {
          try {
            if (conn.destroy) conn.destroy();
          } catch (e) {
            console.error("Error destroying connection:", e);
          }
        });
        resolve();
      }, timeoutMs);

      // Try to close the server gracefully
      server.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  beforeEach(async function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create unique name for container if Docker is available
    if (dockerAvailable) {
      containerName = uniqueName("codebox-test-container");
      // Create a test file in the workspace directory
      createTestFile(
        path.join(workspaceDir, "test.txt"),
        "Hello from HTTP test!"
      );
      // Create a test container
      await createTestContainer(containerName, dockerImage, workspaceDir);
    }

    // Start the HTTP server
    port = await startTestServer();

    // Create a new client
    client = new Client({
      name: "integration-test-client",
      version: "1.0.0",
    });
  });

  afterEach(async function () {
    // First close the client if connected to free up connections
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.warn("Error closing client:", error);
      }
    }

    // Close the HTTP server if it exists with a timeout
    if (httpServer) {
      await closeHttpServer(httpServer, 3000);
    }

    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("Basic HTTP Connectivity", function () {
    it("should respond to HTTP health check", async function () {
      // Simple fetch to verify the server is running
      const response = await fetch(baseUrl);
      expect(response.status).to.be.greaterThanOrEqual(400); // Expect error without session ID, but server is responding
    });

    it("should establish an MCP session via HTTP", async function () {
      // Connect the client to the server
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));

      try {
        await client.connect(transport);
        expect(transport.sessionId).to.be.a("string");
      } catch (error) {
        console.error("Connection error:", error);
        throw error;
      }
    });
  });

  // Rest of the test file remains the same
  describe("Workspace Operations via HTTP", function () {
    beforeEach(function () {
      if (!dockerAvailable) {
        this.skip();
        return;
      }

      // Create test config with workspaces
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            path: workspaceDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should list workspaces via HTTP", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // List workspaces
      const response = (await client.callTool({
        name: "list_workspaces",
        arguments: {},
      })) as ToolResponse;

      // Check the response contains our workspace
      expect(response.content).to.be.an("array");
      expect(response.content[0].type).to.equal("text");
      expect(response.content[0].text).to.include(workspaceName);
    });

    it("should execute the full workspace lifecycle via HTTP", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // 1. Open workspace
      const openResponse = (await client.callTool({
        name: "open_workspace",
        arguments: {
          workspaceName: workspaceName,
        },
      })) as ToolResponse;

      const workspaceToken = openResponse.content[0].text;
      expect(workspaceToken).to.be.a("string");

      // 2. Execute command in workspace
      const execResponse = (await client.callTool({
        name: "execute_command",
        arguments: {
          workspaceToken: workspaceToken,
          command: "cat /workspace/test.txt",
        },
      })) as ToolResponse;

      expect(execResponse.content[0].text).to.include("Hello from HTTP test!");

      // 3. Write a file to workspace
      const writeResponse = (await client.callTool({
        name: "write_file",
        arguments: {
          workspaceToken: workspaceToken,
          filePath: "http-generated.txt",
          content: "File created via HTTP",
          mode: "overwrite",
        },
      })) as ToolResponse;

      expect(writeResponse.content[0].text).to.include(
        "Successfully wrote file"
      );

      // Verify the file was created
      const verifyResponse = (await client.callTool({
        name: "execute_command",
        arguments: {
          workspaceToken: workspaceToken,
          command: "cat /workspace/http-generated.txt",
        },
      })) as ToolResponse;

      expect(verifyResponse.content[0].text).to.include(
        "File created via HTTP"
      );

      // 4. Close workspace
      const closeResponse = (await client.callTool({
        name: "close_workspace",
        arguments: {
          workspaceToken: workspaceToken,
        },
      })) as ToolResponse;

      expect(closeResponse.content[0].text).to.include(
        "Workspace token closed"
      );
    });
  });

  describe("Batch Operations via HTTP", function () {
    beforeEach(function () {
      if (!dockerAvailable) {
        this.skip();
        return;
      }

      // Create test config with workspaces
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            path: workspaceDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should execute batch commands via HTTP", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // Open workspace
      const openResponse = (await client.callTool({
        name: "open_workspace",
        arguments: {
          workspaceName: workspaceName,
        },
      })) as ToolResponse;

      const workspaceToken = openResponse.content[0].text;

      // Execute batch commands
      const batchResponse = (await client.callTool({
        name: "execute_batch_commands",
        arguments: {
          workspaceToken: workspaceToken,
          commands: [
            "echo 'First batch command' > /workspace/batch.txt",
            "echo 'Second batch command' >> /workspace/batch.txt",
            "cat /workspace/batch.txt",
          ],
          stopOnError: true,
        },
      })) as ToolResponse;

      expect(batchResponse.content[0].text).to.include("First batch command");
      expect(batchResponse.content[0].text).to.include("Second batch command");

      // Close workspace
      await client.callTool({
        name: "close_workspace",
        arguments: {
          workspaceToken: workspaceToken,
        },
      });
    });

    it("should write batch files via HTTP", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // Open workspace
      const openResponse = (await client.callTool({
        name: "open_workspace",
        arguments: {
          workspaceName: workspaceName,
        },
      })) as ToolResponse;

      const workspaceToken = openResponse.content[0].text;

      // Write batch files
      const batchFilesResponse = (await client.callTool({
        name: "write_batch_files",
        arguments: {
          workspaceToken: workspaceToken,
          files: [
            {
              filePath: "http-file1.txt",
              content: "Content for file 1",
              mode: "overwrite",
            },
            {
              filePath: "http-file2.txt",
              content: "Content for file 2",
              mode: "overwrite",
            },
          ],
          stopOnError: true,
        },
      })) as ToolResponse;

      expect(batchFilesResponse.content[0].text).to.include("Success");

      // Verify files were created
      const verifyResponse = (await client.callTool({
        name: "execute_batch_commands",
        arguments: {
          workspaceToken: workspaceToken,
          commands: [
            "cat /workspace/http-file1.txt",
            "cat /workspace/http-file2.txt",
          ],
        },
      })) as ToolResponse;

      expect(verifyResponse.content[0].text).to.include("Content for file 1");
      expect(verifyResponse.content[0].text).to.include("Content for file 2");

      // Close workspace
      await client.callTool({
        name: "close_workspace",
        arguments: {
          workspaceToken: workspaceToken,
        },
      });
    });
  });

  describe("Error Handling via HTTP", function () {
    beforeEach(function () {
      if (!dockerAvailable) {
        this.skip();
        return;
      }

      // Create test config with workspaces
      createTestConfig(configDir, {
        workspaces: [
          {
            name: workspaceName,
            path: workspaceDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should handle invalid workspace tokens correctly", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // Try to execute command with invalid token
      const execResponse = (await client.callTool({
        name: "execute_command",
        arguments: {
          workspaceToken: "invalid-token",
          command: "echo test",
        },
      })) as ToolResponse;

      expect(execResponse.isError).to.equal(true);
      expect(execResponse.content[0].text).to.include(
        "Invalid or expired workspace token"
      );
    });

    it("should handle command execution errors correctly", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // Open workspace
      const openResponse = (await client.callTool({
        name: "open_workspace",
        arguments: {
          workspaceName: workspaceName,
        },
      })) as ToolResponse;

      const workspaceToken = openResponse.content[0].text;

      // Execute invalid command
      const execResponse = (await client.callTool({
        name: "execute_command",
        arguments: {
          workspaceToken: workspaceToken,
          command: "cat /nonexistent/file.txt",
        },
      })) as ToolResponse;

      expect(execResponse.isError).to.equal(true);
      expect(execResponse.content[0].text).to.include(
        "Error executing command"
      );

      // Close workspace
      await client.callTool({
        name: "close_workspace",
        arguments: {
          workspaceToken: workspaceToken,
        },
      });
    });

    it("should handle file operation errors correctly", async function () {
      // Connect the client
      const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
      await client.connect(transport);

      // Open workspace
      const openResponse = (await client.callTool({
        name: "open_workspace",
        arguments: {
          workspaceName: workspaceName,
        },
      })) as ToolResponse;

      const workspaceToken = openResponse.content[0].text;

      // Attempt path traversal attack
      const writeResponse = (await client.callTool({
        name: "write_file",
        arguments: {
          workspaceToken: workspaceToken,
          filePath: "../outside.txt",
          content: "This should fail",
          mode: "overwrite",
        },
      })) as ToolResponse;

      expect(writeResponse.isError).to.equal(true);
      expect(writeResponse.content[0].text).to.include("Invalid file path");

      // Close workspace
      await client.callTool({
        name: "close_workspace",
        arguments: {
          workspaceToken: workspaceToken,
        },
      });
    });
  });
});
