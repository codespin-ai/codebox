// src/test/integration/routes/oauth/registration.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import express from "express";
import request from "supertest";
import { registerRegistrationRoutes } from "../../../../routes/oauth/registration.js";
import { _clearAllTokens, getRegisteredClient } from "../../../../auth/token-store.js";

describe("OAuth Registration Routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    registerRegistrationRoutes(app);
    _clearAllTokens();
  });

  afterEach(() => {
    _clearAllTokens();
  });

  describe("POST /register", () => {
    it("should register a new client with redirect_uris", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          redirect_uris: ["http://localhost:3000/callback"],
          client_name: "Test App",
        });

      expect(res.status).to.equal(201);
      expect(res.body.client_id).to.be.a("string");
      expect(res.body.client_secret).to.be.a("string");
      expect(res.body.redirect_uris).to.deep.equal(["http://localhost:3000/callback"]);
      expect(res.body.client_name).to.equal("Test App");
      expect(res.body.client_id_issued_at).to.be.a("number");
    });

    it("should store the registered client", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          redirect_uris: ["http://localhost:3000/callback"],
        });

      const client = getRegisteredClient(res.body.client_id);
      expect(client).to.not.be.undefined;
      expect(client!.clientId).to.equal(res.body.client_id);
      expect(client!.clientSecret).to.equal(res.body.client_secret);
      expect(client!.redirectUris).to.deep.equal(["http://localhost:3000/callback"]);
    });

    it("should return error when redirect_uris is missing", async () => {
      const res = await request(app).post("/register").send({
        client_name: "Test App",
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_redirect_uri");
    });

    it("should return error when redirect_uris is empty", async () => {
      const res = await request(app).post("/register").send({
        redirect_uris: [],
      });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal("invalid_redirect_uri");
    });

    it("should register client without client_name", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          redirect_uris: ["http://localhost:3000/callback"],
        });

      expect(res.status).to.equal(201);
      expect(res.body.client_name).to.be.undefined;
    });

    it("should support multiple redirect_uris", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          redirect_uris: [
            "http://localhost:3000/callback",
            "http://localhost:3001/callback",
            "https://example.com/oauth/callback",
          ],
        });

      expect(res.status).to.equal(201);
      expect(res.body.redirect_uris).to.have.length(3);
    });
  });
});
