// src/test/integration/auth/pkce.test.ts
import { expect } from "chai";
import { describe, it } from "mocha";
import {
  verifyCodeChallenge,
  generateAccessToken,
  generateRefreshToken,
  generateCsrfToken,
} from "../../../auth/pkce.js";
import * as crypto from "crypto";

describe("PKCE Utilities", () => {
  describe("verifyCodeChallenge", () => {
    it("should verify a valid S256 code challenge", () => {
      // Generate a code verifier (43-128 chars, URL-safe)
      const codeVerifier = crypto.randomBytes(32).toString("base64url");

      // Generate the code challenge using S256
      const hash = crypto.createHash("sha256").update(codeVerifier).digest();
      const codeChallenge = hash.toString("base64url");

      const result = verifyCodeChallenge(codeVerifier, codeChallenge, "S256");
      expect(result).to.be.true;
    });

    it("should reject an invalid code verifier", () => {
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const wrongVerifier = crypto.randomBytes(32).toString("base64url");

      const hash = crypto.createHash("sha256").update(codeVerifier).digest();
      const codeChallenge = hash.toString("base64url");

      const result = verifyCodeChallenge(wrongVerifier, codeChallenge, "S256");
      expect(result).to.be.false;
    });

    it("should return false for unsupported challenge method", () => {
      const codeVerifier = "test_verifier";
      const codeChallenge = "test_challenge";

      const result = verifyCodeChallenge(codeVerifier, codeChallenge, "plain");
      expect(result).to.be.false;
    });

    it("should handle edge case with empty strings", () => {
      const result = verifyCodeChallenge("", "", "S256");
      expect(result).to.be.false;
    });

    it("should work with various valid code verifier lengths", () => {
      // Test with minimum length (43 chars)
      const shortVerifier = crypto.randomBytes(32).toString("base64url").slice(0, 43);
      const shortHash = crypto.createHash("sha256").update(shortVerifier).digest();
      const shortChallenge = shortHash.toString("base64url");
      expect(verifyCodeChallenge(shortVerifier, shortChallenge, "S256")).to.be.true;

      // Test with maximum length (128 chars)
      const longVerifier = crypto.randomBytes(96).toString("base64url").slice(0, 128);
      const longHash = crypto.createHash("sha256").update(longVerifier).digest();
      const longChallenge = longHash.toString("base64url");
      expect(verifyCodeChallenge(longVerifier, longChallenge, "S256")).to.be.true;
    });
  });

  describe("generateAccessToken", () => {
    it("should generate a token of appropriate length", () => {
      const token = generateAccessToken();
      expect(token).to.be.a("string");
      expect(token.length).to.be.greaterThan(20);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateAccessToken());
      }
      expect(tokens.size).to.equal(100);
    });

    it("should generate URL-safe tokens", () => {
      const token = generateAccessToken();
      // URL-safe base64 should not contain +, /, or =
      expect(token).to.not.match(/[+/=]/);
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a token of appropriate length", () => {
      const token = generateRefreshToken();
      expect(token).to.be.a("string");
      expect(token.length).to.be.greaterThan(20);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateRefreshToken());
      }
      expect(tokens.size).to.equal(100);
    });

    it("should generate URL-safe tokens", () => {
      const token = generateRefreshToken();
      expect(token).to.not.match(/[+/=]/);
    });
  });

  describe("generateCsrfToken", () => {
    it("should generate a token of appropriate length", () => {
      const token = generateCsrfToken();
      expect(token).to.be.a("string");
      expect(token.length).to.be.greaterThan(20);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).to.equal(100);
    });

    it("should generate URL-safe tokens", () => {
      const token = generateCsrfToken();
      expect(token).to.not.match(/[+/=]/);
    });
  });
});
