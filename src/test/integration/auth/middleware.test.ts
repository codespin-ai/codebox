// src/test/integration/auth/middleware.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import express from "express";
import request from "supertest";
import { authMiddleware, getServerUrl } from "../../../auth/middleware.js";
import { _clearAllTokens, setAccessToken, TOKEN_EXPIRATION_MS } from "../../../auth/token-store.js";

describe("Auth Middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    _clearAllTokens();

    // Protected route for testing
    app.get("/protected", authMiddleware, (_req, res) => {
      res.json({ success: true });
    });
  });

  afterEach(() => {
    _clearAllTokens();
  });

  describe("authMiddleware", () => {
    it("should reject requests without Authorization header", async () => {
      const res = await request(app).get("/protected");

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("unauthorized");
      expect(res.body.error_description).to.include("Missing or invalid Authorization header");
    });

    it("should reject requests with non-Bearer Authorization", async () => {
      const res = await request(app)
        .get("/protected")
        .set("Authorization", "Basic dXNlcjpwYXNz");

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("unauthorized");
    });

    it("should reject requests with invalid token", async () => {
      const res = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("invalid_token");
      expect(res.body.error_description).to.include("invalid or expired");
    });

    it("should allow requests with valid token", async () => {
      const validToken = "valid-access-token-123";
      setAccessToken(validToken, {
        expiresAt: Date.now() + TOKEN_EXPIRATION_MS,
      });

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
    });

    it("should reject expired tokens", async () => {
      const expiredToken = "expired-token-123";
      setAccessToken(expiredToken, {
        expiresAt: Date.now() - 1000, // Already expired
      });

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("invalid_token");
    });
  });

  describe("getServerUrl", () => {
    it("should return URL from host header", () => {
      const mockReq = {
        headers: { host: "localhost:3000" },
        protocol: "http",
      } as unknown as express.Request;

      expect(getServerUrl(mockReq)).to.equal("http://localhost:3000");
    });

    it("should use X-Forwarded-Proto header when present", () => {
      const mockReq = {
        headers: {
          host: "localhost:3000",
          "x-forwarded-proto": "https",
        },
        protocol: "http",
      } as unknown as express.Request;

      expect(getServerUrl(mockReq)).to.equal("https://localhost:3000");
    });

    it("should use X-Forwarded-Host header when present", () => {
      const mockReq = {
        headers: {
          host: "localhost:3000",
          "x-forwarded-host": "api.example.com",
        },
        protocol: "http",
      } as unknown as express.Request;

      expect(getServerUrl(mockReq)).to.equal("http://api.example.com");
    });

    it("should handle both X-Forwarded headers", () => {
      const mockReq = {
        headers: {
          host: "localhost:3000",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "api.example.com",
        },
        protocol: "http",
      } as unknown as express.Request;

      expect(getServerUrl(mockReq)).to.equal("https://api.example.com");
    });

    it("should default to localhost when no host header", () => {
      const mockReq = {
        headers: {},
        protocol: "http",
      } as unknown as express.Request;

      expect(getServerUrl(mockReq)).to.equal("http://localhost");
    });
  });
});
