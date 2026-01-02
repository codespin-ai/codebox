// src/test/integration/routes/oauth/discovery.test.ts
import { expect } from "chai";
import { describe, it } from "mocha";
import express from "express";
import request from "supertest";
import { registerDiscoveryRoutes } from "../../../../routes/oauth/discovery.js";

describe("OAuth Discovery Routes", () => {
  const app = express();
  registerDiscoveryRoutes(app);

  describe("GET /.well-known/oauth-protected-resource", () => {
    it("should return protected resource metadata", async () => {
      const res = await request(app)
        .get("/.well-known/oauth-protected-resource")
        .set("Host", "localhost:3000");

      expect(res.status).to.equal(200);
      expect(res.body.resource).to.equal("http://localhost:3000");
      expect(res.body.authorization_servers).to.deep.equal(["http://localhost:3000"]);
      expect(res.body.bearer_methods_supported).to.deep.equal(["header"]);
    });

    it("should handle X-Forwarded headers", async () => {
      const res = await request(app)
        .get("/.well-known/oauth-protected-resource")
        .set("Host", "localhost:3000")
        .set("X-Forwarded-Proto", "https")
        .set("X-Forwarded-Host", "api.example.com");

      expect(res.status).to.equal(200);
      expect(res.body.resource).to.equal("https://api.example.com");
    });
  });

  describe("GET /.well-known/oauth-authorization-server", () => {
    it("should return authorization server metadata", async () => {
      const res = await request(app)
        .get("/.well-known/oauth-authorization-server")
        .set("Host", "localhost:3000");

      expect(res.status).to.equal(200);
      expect(res.body.issuer).to.equal("http://localhost:3000");
      expect(res.body.authorization_endpoint).to.equal("http://localhost:3000/authorize");
      expect(res.body.token_endpoint).to.equal("http://localhost:3000/token");
      expect(res.body.registration_endpoint).to.equal("http://localhost:3000/register");
      expect(res.body.response_types_supported).to.deep.equal(["code"]);
      expect(res.body.grant_types_supported).to.deep.equal([
        "authorization_code",
        "refresh_token",
        "client_credentials",
      ]);
      expect(res.body.token_endpoint_auth_methods_supported).to.deep.equal(["client_secret_post"]);
      expect(res.body.code_challenge_methods_supported).to.deep.equal(["S256"]);
    });
  });
});
