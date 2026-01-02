// src/test/integration/routes/oauth/authorization.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import express from "express";
import request from "supertest";
import { registerAuthorizationRoutes } from "../../../../routes/oauth/authorization.js";
import {
  _clearAllTokens,
  setRegisteredClient,
  getPendingAuthorization,
  getAuthorizationCode,
} from "../../../../auth/token-store.js";
import * as crypto from "crypto";

// Helper to generate PKCE challenge
function generatePkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("OAuth Authorization Routes", () => {
  let app: express.Express;
  const testClientId = "test-client-123";
  const testRedirectUri = "http://localhost:3000/callback";

  beforeEach(() => {
    app = express();
    registerAuthorizationRoutes(app);
    _clearAllTokens();

    // Register a test client
    setRegisteredClient(testClientId, {
      clientId: testClientId,
      clientSecret: "test-secret",
      redirectUris: [testRedirectUri, "http://localhost:*/callback"],
      clientName: "Test App",
      createdAt: Date.now(),
    });
  });

  afterEach(() => {
    _clearAllTokens();
  });

  describe("GET /authorize", () => {
    it("should show consent screen for valid request", async () => {
      const { challenge } = generatePkce();

      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "test-state",
      });

      expect(res.status).to.equal(200);
      expect(res.type).to.equal("text/html");
      expect(res.text).to.include("Authorize Access");
      expect(res.text).to.include("Test App");
      expect(res.text).to.include("csrf_token");
    });

    it("should reject invalid response_type", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "token",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Invalid response_type");
    });

    it("should reject missing client_id", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Missing client_id");
    });

    it("should reject unknown client_id", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: "unknown-client",
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Unknown client_id");
    });

    it("should reject missing redirect_uri", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Missing redirect_uri");
    });

    it("should reject invalid redirect_uri", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: "http://evil.com/callback",
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Invalid redirect_uri");
    });

    it("should support wildcard redirect_uri matching", async () => {
      const { challenge } = generatePkce();

      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: "http://localhost:8080/callback",
        code_challenge: challenge,
        code_challenge_method: "S256",
      });

      expect(res.status).to.equal(200);
    });

    it("should reject missing PKCE code_challenge", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("PKCE required");
    });

    it("should reject non-S256 code_challenge_method", async () => {
      const res = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
        code_challenge: "challenge",
        code_challenge_method: "plain",
      });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Only S256");
    });
  });

  describe("POST /authorize", () => {
    it("should reject missing CSRF token", async () => {
      const res = await request(app)
        .post("/authorize")
        .type("form")
        .send({ action: "allow" });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("missing CSRF token");
    });

    it("should reject invalid CSRF token", async () => {
      const res = await request(app)
        .post("/authorize")
        .type("form")
        .send({ csrf_token: "invalid-token", action: "allow" });

      expect(res.status).to.equal(400);
      expect(res.text).to.include("Invalid or expired");
    });

    it("should redirect with access_denied when user denies", async () => {
      const { challenge } = generatePkce();

      // First, get the consent screen to get a valid CSRF token
      const getRes = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "test-state",
      });

      // Extract CSRF token from HTML
      const csrfMatch = getRes.text.match(/name="csrf_token" value="([^"]+)"/);
      expect(csrfMatch).to.not.be.null;
      const csrfToken = csrfMatch![1];

      // Submit denial
      const postRes = await request(app)
        .post("/authorize")
        .type("form")
        .send({ csrf_token: csrfToken, action: "deny" });

      expect(postRes.status).to.equal(302);
      expect(postRes.headers.location).to.include("error=access_denied");
      expect(postRes.headers.location).to.include("state=test-state");
    });

    it("should redirect with authorization code when user allows", async () => {
      const { challenge } = generatePkce();

      // First, get the consent screen
      const getRes = await request(app).get("/authorize").query({
        response_type: "code",
        client_id: testClientId,
        redirect_uri: testRedirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "test-state",
      });

      const csrfMatch = getRes.text.match(/name="csrf_token" value="([^"]+)"/);
      const csrfToken = csrfMatch![1];

      // Submit approval
      const postRes = await request(app)
        .post("/authorize")
        .type("form")
        .send({ csrf_token: csrfToken, action: "allow" });

      expect(postRes.status).to.equal(302);
      expect(postRes.headers.location).to.include("code=");
      expect(postRes.headers.location).to.include("state=test-state");
      expect(postRes.headers.location).to.not.include("error=");

      // Verify authorization code was stored
      const codeMatch = postRes.headers.location.match(/code=([^&]+)/);
      const code = codeMatch![1];
      const storedCode = getAuthorizationCode(code);
      expect(storedCode).to.not.be.undefined;
      expect(storedCode!.clientId).to.equal(testClientId);
    });
  });
});
