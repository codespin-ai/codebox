// src/test/integration/routes/oauth/token.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import express from "express";
import request from "supertest";
import { registerTokenRoutes } from "../../../../routes/oauth/token/index.js";
import {
  _clearAllTokens,
  setRegisteredClient,
  setAuthorizationCode,
  setRefreshToken,
  validateAccessToken,
  AUTH_CODE_EXPIRATION_MS,
  REFRESH_TOKEN_EXPIRATION_MS,
} from "../../../../auth/token-store.js";
import * as crypto from "crypto";

// Helper to generate PKCE
function generatePkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

describe("OAuth Token Routes", () => {
  let app: express.Express;
  const testClientId = "test-client-123";
  const testClientSecret = "test-secret-456";
  const testRedirectUri = "http://localhost:3000/callback";

  beforeEach(() => {
    app = express();
    registerTokenRoutes(app);
    _clearAllTokens();

    // Register a test client
    setRegisteredClient(testClientId, {
      clientId: testClientId,
      clientSecret: testClientSecret,
      redirectUris: [testRedirectUri],
      clientName: "Test App",
      createdAt: Date.now(),
    });
  });

  afterEach(() => {
    _clearAllTokens();
  });

  describe("POST /token - authorization_code grant", () => {
    it("should exchange valid authorization code for tokens", async () => {
      const { verifier, challenge } = generatePkce();
      const authCode = "test-auth-code-123";

      // Store a valid auth code
      setAuthorizationCode(authCode, {
        clientId: testClientId,
        redirectUri: testRedirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        expiresAt: Date.now() + AUTH_CODE_EXPIRATION_MS,
      });

      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: verifier,
        redirect_uri: testRedirectUri,
        client_id: testClientId,
      });

      expect(res.status).to.equal(200);
      expect(res.body.access_token).to.be.a("string");
      expect(res.body.refresh_token).to.be.a("string");
      expect(res.body.token_type).to.equal("Bearer");
      expect(res.body.expires_in).to.be.a("number");
    });

    it("should validate the issued access token", async () => {
      const { verifier, challenge } = generatePkce();
      const authCode = "test-auth-code-456";

      setAuthorizationCode(authCode, {
        clientId: testClientId,
        redirectUri: testRedirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        expiresAt: Date.now() + AUTH_CODE_EXPIRATION_MS,
      });

      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: verifier,
        redirect_uri: testRedirectUri,
      });

      expect(validateAccessToken(res.body.access_token)).to.be.true;
    });

    it("should reject missing code", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code_verifier: "test-verifier",
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_request");
    });

    it("should reject invalid authorization code", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: "invalid-code",
        code_verifier: "test-verifier",
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
    });

    it("should reject expired authorization code", async () => {
      const { verifier, challenge } = generatePkce();
      const authCode = "expired-auth-code";

      setAuthorizationCode(authCode, {
        clientId: testClientId,
        redirectUri: testRedirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        expiresAt: Date.now() - 1000, // Already expired
      });

      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: verifier,
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
      expect(res.body.error_description).to.include("expired");
    });

    it("should reject mismatched redirect_uri", async () => {
      const { verifier, challenge } = generatePkce();
      const authCode = "test-auth-code-789";

      setAuthorizationCode(authCode, {
        clientId: testClientId,
        redirectUri: testRedirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        expiresAt: Date.now() + AUTH_CODE_EXPIRATION_MS,
      });

      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: verifier,
        redirect_uri: "http://different.com/callback",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
      expect(res.body.error_description).to.include("Redirect URI");
    });

    it("should reject invalid code_verifier", async () => {
      const { challenge } = generatePkce();
      const authCode = "test-auth-code-pkce";

      setAuthorizationCode(authCode, {
        clientId: testClientId,
        redirectUri: testRedirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
        expiresAt: Date.now() + AUTH_CODE_EXPIRATION_MS,
      });

      const res = await request(app).post("/token").send({
        grant_type: "authorization_code",
        code: authCode,
        code_verifier: "wrong-verifier",
        redirect_uri: testRedirectUri,
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
      expect(res.body.error_description).to.include("code_verifier");
    });
  });

  describe("POST /token - refresh_token grant", () => {
    it("should refresh tokens with valid refresh_token", async () => {
      const refreshToken = "test-refresh-token-123";

      setRefreshToken(refreshToken, {
        clientId: testClientId,
        expiresAt: Date.now() + REFRESH_TOKEN_EXPIRATION_MS,
      });

      const res = await request(app).post("/token").send({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });

      expect(res.status).to.equal(200);
      expect(res.body.access_token).to.be.a("string");
      expect(res.body.refresh_token).to.be.a("string");
      expect(res.body.refresh_token).to.not.equal(refreshToken); // Token rotation
      expect(res.body.token_type).to.equal("Bearer");
    });

    it("should reject missing refresh_token", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "refresh_token",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_request");
    });

    it("should reject invalid refresh_token", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "refresh_token",
        refresh_token: "invalid-token",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
    });

    it("should reject expired refresh_token", async () => {
      const refreshToken = "expired-refresh-token";

      setRefreshToken(refreshToken, {
        clientId: testClientId,
        expiresAt: Date.now() - 1000,
      });

      const res = await request(app).post("/token").send({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_grant");
      expect(res.body.error_description).to.include("expired");
    });
  });

  describe("POST /token - client_credentials grant", () => {
    it("should issue token with valid registered client credentials", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "client_credentials",
        client_id: testClientId,
        client_secret: testClientSecret,
      });

      expect(res.status).to.equal(200);
      expect(res.body.access_token).to.be.a("string");
      expect(res.body.token_type).to.equal("Bearer");
      expect(res.body.expires_in).to.be.a("number");
      expect(res.body.refresh_token).to.be.undefined; // No refresh token for client_credentials
    });

    it("should reject invalid client credentials", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "client_credentials",
        client_id: testClientId,
        client_secret: "wrong-secret",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("invalid_client");
    });

    it("should reject unknown client_id", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "client_credentials",
        client_id: "unknown-client",
        client_secret: "some-secret",
      });

      expect(res.status).to.equal(401);
      expect(res.body.error).to.equal("invalid_client");
    });
  });

  describe("POST /token - unsupported grant_type", () => {
    it("should reject unsupported grant_type", async () => {
      const res = await request(app).post("/token").send({
        grant_type: "password",
        username: "user",
        password: "pass",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("unsupported_grant_type");
    });
  });
});
