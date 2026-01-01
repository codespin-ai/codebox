// src/test/integration/auth/token-store.test.ts
import { expect } from "chai";
import { describe, it, beforeEach } from "mocha";
import {
  setAccessToken,
  validateAccessToken,
  deleteAccessToken,
  setRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  setAuthorizationCode,
  getAuthorizationCode,
  deleteAuthorizationCode,
  setPendingAuthorization,
  getPendingAuthorization,
  deletePendingAuthorization,
  setRegisteredClient,
  getRegisteredClient,
  _clearAllTokens,
} from "../../../auth/token-store.js";

describe("Token Store", () => {
  beforeEach(() => {
    _clearAllTokens();
  });

  describe("Access Tokens", () => {
    it("should store and validate an access token", () => {
      const expiresAt = Date.now() + 3600 * 1000;
      setAccessToken("test-token", { expiresAt });
      expect(validateAccessToken("test-token")).to.be.true;
    });

    it("should reject an invalid access token", () => {
      expect(validateAccessToken("nonexistent-token")).to.be.false;
    });

    it("should reject an expired access token", () => {
      const expiresAt = Date.now() - 1000; // Already expired
      setAccessToken("expired-token", { expiresAt });
      expect(validateAccessToken("expired-token")).to.be.false;
    });

    it("should delete an access token", () => {
      const expiresAt = Date.now() + 3600 * 1000;
      setAccessToken("revokable-token", { expiresAt });
      expect(validateAccessToken("revokable-token")).to.be.true;
      deleteAccessToken("revokable-token");
      expect(validateAccessToken("revokable-token")).to.be.false;
    });
  });

  describe("Refresh Tokens", () => {
    it("should store and retrieve a refresh token", () => {
      const expiresAt = Date.now() + 86400 * 1000;
      setRefreshToken("refresh-token", { clientId: "client-123", expiresAt });
      const data = getRefreshToken("refresh-token");
      expect(data).to.not.be.undefined;
      expect(data!.clientId).to.equal("client-123");
    });

    it("should return undefined for nonexistent refresh token", () => {
      const data = getRefreshToken("nonexistent");
      expect(data).to.be.undefined;
    });

    it("should delete a refresh token", () => {
      const expiresAt = Date.now() + 86400 * 1000;
      setRefreshToken("revokable-refresh", { clientId: "client-123", expiresAt });
      expect(getRefreshToken("revokable-refresh")).to.not.be.undefined;
      deleteRefreshToken("revokable-refresh");
      expect(getRefreshToken("revokable-refresh")).to.be.undefined;
    });
  });

  describe("Authorization Codes", () => {
    it("should store and retrieve an authorization code", () => {
      const expiresAt = Date.now() + 600 * 1000;
      setAuthorizationCode("auth-code", {
        clientId: "client-123",
        redirectUri: "http://localhost/callback",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        expiresAt,
      });
      const data = getAuthorizationCode("auth-code");
      expect(data).to.not.be.undefined;
      expect(data!.clientId).to.equal("client-123");
      expect(data!.redirectUri).to.equal("http://localhost/callback");
    });

    it("should return undefined for nonexistent auth code", () => {
      expect(getAuthorizationCode("nonexistent")).to.be.undefined;
    });

    it("should delete an authorization code", () => {
      const expiresAt = Date.now() + 600 * 1000;
      setAuthorizationCode("one-time-code", {
        clientId: "client-123",
        redirectUri: "http://localhost/callback",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        expiresAt,
      });
      expect(getAuthorizationCode("one-time-code")).to.not.be.undefined;
      deleteAuthorizationCode("one-time-code");
      expect(getAuthorizationCode("one-time-code")).to.be.undefined;
    });
  });

  describe("Pending Authorizations", () => {
    it("should store and retrieve a pending authorization", () => {
      const expiresAt = Date.now() + 600 * 1000;
      setPendingAuthorization("pending-123", {
        clientId: "client-123",
        redirectUri: "http://localhost/callback",
        state: "state-value",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        expiresAt,
      });
      const data = getPendingAuthorization("pending-123");
      expect(data).to.not.be.undefined;
      expect(data!.clientId).to.equal("client-123");
      expect(data!.state).to.equal("state-value");
    });

    it("should delete a pending authorization", () => {
      const expiresAt = Date.now() + 600 * 1000;
      setPendingAuthorization("consume-pending", {
        clientId: "client-123",
        redirectUri: "http://localhost/callback",
        state: "state-value",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        expiresAt,
      });
      expect(getPendingAuthorization("consume-pending")).to.not.be.undefined;
      deletePendingAuthorization("consume-pending");
      expect(getPendingAuthorization("consume-pending")).to.be.undefined;
    });
  });

  describe("Client Registration", () => {
    it("should register and retrieve a client", () => {
      setRegisteredClient("new-client", {
        clientId: "new-client",
        clientSecret: "secret",
        redirectUris: ["http://localhost/callback"],
        clientName: "Test Client",
        createdAt: Date.now(),
      });
      const client = getRegisteredClient("new-client");
      expect(client).to.not.be.undefined;
      expect(client!.clientName).to.equal("Test Client");
      expect(client!.redirectUris).to.include("http://localhost/callback");
    });

    it("should return undefined for nonexistent client", () => {
      expect(getRegisteredClient("nonexistent")).to.be.undefined;
    });

    it("should handle client without optional fields", () => {
      setRegisteredClient("minimal-client", {
        clientId: "minimal-client",
        redirectUris: ["http://localhost/callback"],
        createdAt: Date.now(),
      });
      const client = getRegisteredClient("minimal-client");
      expect(client).to.not.be.undefined;
      expect(client!.clientSecret).to.be.undefined;
      expect(client!.clientName).to.be.undefined;
    });
  });

  describe("_clearAllTokens", () => {
    it("should clear all stored tokens", () => {
      const expiresAt = Date.now() + 3600 * 1000;
      setAccessToken("access", { expiresAt });
      setRefreshToken("refresh", { clientId: "client", expiresAt });
      setRegisteredClient("client", {
        clientId: "client",
        redirectUris: ["http://localhost"],
        createdAt: Date.now(),
      });

      _clearAllTokens();

      expect(validateAccessToken("access")).to.be.false;
      expect(getRefreshToken("refresh")).to.be.undefined;
      expect(getRegisteredClient("client")).to.be.undefined;
    });
  });
});
