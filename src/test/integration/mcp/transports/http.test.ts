// src/test/integration/mcp/transports/http.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import request from "supertest";
import type * as http from "http";
import { startHttpTransport } from "../../../../mcp/transports/http/index.js";
import { _clearAllTokens } from "../../../../auth/token-store.js";

describe("HTTP Transport", () => {
  let server: http.Server;
  const testPort = 13099; // Use a different port to avoid conflicts

  afterEach(async () => {
    _clearAllTokens();
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe("with authentication enabled", () => {
    beforeEach(async () => {
      _clearAllTokens();
      server = await startHttpTransport({
        host: "127.0.0.1",
        port: testPort,
        auth: true,
      });
    });

    it("should reject MCP requests without auth token", async () => {
      const res = await request(server)
        .post("/mcp")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("unauthorized");
    });

    it("should reject MCP requests with invalid auth token", async () => {
      const res = await request(server)
        .post("/mcp")
        .set("Authorization", "Bearer invalid-token")
        .send({ jsonrpc: "2.0", method: "initialize", id: 1 });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("invalid_token");
    });

    it("should serve OAuth discovery endpoints without auth", async () => {
      const res = await request(server).get("/.well-known/oauth-authorization-server");

      expect(res.status).to.equal(200);
      expect(res.body.issuer).to.be.a("string");
      expect(res.body.token_endpoint).to.be.a("string");
    });

    it("should serve protected resource metadata without auth", async () => {
      const res = await request(server).get("/.well-known/oauth-protected-resource");

      expect(res.status).to.equal(200);
      expect(res.body.resource).to.be.a("string");
    });
  });

  describe("with authentication disabled", () => {
    beforeEach(async () => {
      _clearAllTokens();
      server = await startHttpTransport({
        host: "127.0.0.1",
        port: testPort + 1,
        auth: false,
      });
    });

    it("should accept MCP initialize request without auth", async () => {
      const res = await request(server)
        .post("/mcp")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" },
          },
          id: 1,
        });

      // Should not be 401, could be 200 or other MCP response
      expect(res.status).to.not.equal(401);
    });

    it("should reject GET /mcp without session", async () => {
      const res = await request(server).get("/mcp");

      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.include("No valid session");
    });

    it("should reject DELETE /mcp without session", async () => {
      const res = await request(server).delete("/mcp");

      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.include("No valid session");
    });

    it("should reject POST /mcp with invalid session id", async () => {
      const res = await request(server)
        .post("/mcp")
        .set("mcp-session-id", "invalid-session-id")
        .send({ jsonrpc: "2.0", method: "tools/list", id: 1 });

      expect(res.status).to.equal(400);
      // The error message may say "Session not found" or "missing or invalid mcp-session-id"
      expect(res.body.error.message).to.satisfy(
        (msg: string) => msg.includes("Session not found") || msg.includes("mcp-session-id")
      );
    });
  });

  describe("session management", () => {
    beforeEach(async () => {
      _clearAllTokens();
      server = await startHttpTransport({
        host: "127.0.0.1",
        port: testPort + 2,
        auth: false,
      });
    });

    it("should handle initialize request", async () => {
      // The MCP SDK StreamableHTTPServerTransport expects specific request format
      // This test verifies the endpoint is reachable and processes requests
      const res = await request(server)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .send({
          jsonrpc: "2.0",
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" },
          },
          id: 1,
        });

      // The response should be a valid JSON-RPC response (success or error)
      // The exact behavior depends on the MCP SDK version
      expect(res.body).to.have.property("jsonrpc", "2.0");
    });
  });

  describe("CORS", () => {
    beforeEach(async () => {
      _clearAllTokens();
      server = await startHttpTransport({
        host: "127.0.0.1",
        port: testPort + 3,
        auth: false,
      });
    });

    it("should include CORS headers in response", async () => {
      const res = await request(server)
        .options("/mcp")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(res.headers["access-control-allow-origin"]).to.equal("*");
      expect(res.headers["access-control-allow-methods"]).to.include("POST");
    });

    it("should expose MCP-specific headers", async () => {
      const res = await request(server)
        .options("/mcp")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(res.headers["access-control-expose-headers"]).to.include("mcp-session-id");
    });
  });
});
