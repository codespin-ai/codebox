// src/test/integration/auth/credentials.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import * as fs from "fs";
import * as path from "path";
import {
  loadEnvFile,
  createEnvFile,
  getClientCredentials,
  envFileExists,
} from "../../../auth/credentials.js";
import { setupTestEnvironment } from "../setup.js";

describe("Credentials Utilities", () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>;
  let originalCwd: string;
  let originalClientId: string | undefined;
  let originalClientSecret: string | undefined;

  beforeEach(() => {
    testEnv = setupTestEnvironment();
    originalCwd = process.cwd();
    process.chdir(testEnv.testDir);

    // Save original env vars
    originalClientId = process.env.CLIENT_ID;
    originalClientSecret = process.env.CLIENT_SECRET;
    delete process.env.CLIENT_ID;
    delete process.env.CLIENT_SECRET;
  });

  afterEach(() => {
    // Restore env vars
    if (originalClientId !== undefined) {
      process.env.CLIENT_ID = originalClientId;
    } else {
      delete process.env.CLIENT_ID;
    }
    if (originalClientSecret !== undefined) {
      process.env.CLIENT_SECRET = originalClientSecret;
    } else {
      delete process.env.CLIENT_SECRET;
    }

    process.chdir(originalCwd);
    testEnv.cleanup();
  });

  describe("loadEnvFile", () => {
    it("should do nothing when .env does not exist", () => {
      loadEnvFile();
      // Should not throw
    });

    it("should load variables from .env when it exists", () => {
      const envPath = path.join(testEnv.testDir, ".env");
      fs.writeFileSync(envPath, "TEST_VAR=test_value\n");

      loadEnvFile();
      expect(process.env["TEST_VAR"]).to.equal("test_value");

      // Cleanup
      delete process.env["TEST_VAR"];
    });

    it("should handle multiple variables", () => {
      const envPath = path.join(testEnv.testDir, ".env");
      fs.writeFileSync(envPath, "VAR1=value1\nVAR2=value2\nVAR3=value3\n");

      loadEnvFile();
      expect(process.env["VAR1"]).to.equal("value1");
      expect(process.env["VAR2"]).to.equal("value2");
      expect(process.env["VAR3"]).to.equal("value3");

      // Cleanup
      delete process.env["VAR1"];
      delete process.env["VAR2"];
      delete process.env["VAR3"];
    });

    it("should handle comments and empty lines", () => {
      const envPath = path.join(testEnv.testDir, ".env");
      fs.writeFileSync(envPath, "# Comment\n\nVAR=value\n\n# Another comment\n");

      loadEnvFile();
      expect(process.env["VAR"]).to.equal("value");

      delete process.env["VAR"];
    });
  });

  describe("envFileExists", () => {
    it("should return false when .env does not exist", () => {
      expect(envFileExists()).to.be.false;
    });

    it("should return true when .env exists", () => {
      const envPath = path.join(testEnv.testDir, ".env");
      fs.writeFileSync(envPath, "VAR=value\n");
      expect(envFileExists()).to.be.true;
    });
  });

  describe("createEnvFile", () => {
    it("should create a .env file with client credentials", () => {
      const envPath = path.join(testEnv.testDir, ".env");
      const credentials = createEnvFile();

      expect(fs.existsSync(envPath)).to.be.true;
      expect(credentials.clientId).to.be.a("string");
      expect(credentials.clientSecret).to.be.a("string");

      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).to.include("CLIENT_ID=");
      expect(content).to.include("CLIENT_SECRET=");
    });

    it("should generate unique credentials each time", () => {
      const creds1 = createEnvFile();

      // Delete and create again
      fs.unlinkSync(path.join(testEnv.testDir, ".env"));
      const creds2 = createEnvFile();

      expect(creds1.clientId).to.not.equal(creds2.clientId);
    });
  });

  describe("getClientCredentials", () => {
    it("should return credentials from environment variables", () => {
      process.env["CLIENT_ID"] = "test-client-id";
      process.env["CLIENT_SECRET"] = "test-client-secret";

      const creds = getClientCredentials();
      expect(creds).to.not.be.null;
      expect(creds!.clientId).to.equal("test-client-id");
      expect(creds!.clientSecret).to.equal("test-client-secret");
    });

    it("should return null when env vars are not set", () => {
      delete process.env["CLIENT_ID"];
      delete process.env["CLIENT_SECRET"];

      const creds = getClientCredentials();
      expect(creds).to.be.null;
    });

    it("should return null when only CLIENT_ID is set", () => {
      process.env["CLIENT_ID"] = "test-client-id";
      delete process.env["CLIENT_SECRET"];

      const creds = getClientCredentials();
      expect(creds).to.be.null;
    });
  });
});
