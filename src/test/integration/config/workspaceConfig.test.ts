// src/test/integration/config/workspaceConfig.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  getConfig,
  getConfigFilePath,
  getWorkspaceByName,
  isDebugEnabled,
  saveConfig,
  validateWorkspace,
  validateWorkspaceName,
} from "../../../config/workspaceConfig.js";
import { setupTestEnvironment } from "../setup.js";

describe("Workspace Configuration", function () {
  let testDir: string;
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("getConfig and saveConfig", function () {
    it("should return an empty config when no config file exists", function () {
      const config = getConfig();
      expect(config).to.deep.equal({ workspaces: [] });
    });

    it("should save and read the config file correctly", function () {
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "node:18",
          },
        ],
        debug: true,
      };

      saveConfig(testConfig);

      // Verify file was created
      const configFile = getConfigFilePath();
      expect(fs.existsSync(configFile)).to.equal(true);

      // Read back the config
      const readConfig = getConfig();
      expect(readConfig).to.deep.equal(testConfig);
    });
  });

  describe("Workspace Management", function () {
    it("should find a workspace by name", function () {
      // Create test config with a workspace
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Test getWorkspaceByName
      const workspace = getWorkspaceByName("test-workspace");
      expect(workspace).to.not.equal(null);
      expect(workspace?.name).to.equal("test-workspace");

      // Test non-existent workspace
      const nonExistent = getWorkspaceByName("non-existent");
      expect(nonExistent).to.equal(null);
    });

    it("should validate workspace names", function () {
      // Create test config with a workspace
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Test validateWorkspaceName
      expect(validateWorkspaceName("test-workspace")).to.equal(true);
      expect(validateWorkspaceName("non-existent")).to.equal(false);
    });

    it("should validate workspace directories", function () {
      // Create test config with a workspace
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Create a file in the workspace directory
      const nestedPath = path.join(workspaceDir, "nested");
      fs.mkdirSync(nestedPath, { recursive: true });

      // Test validateWorkspace with various paths
      expect(validateWorkspace(workspaceDir)).to.equal(true);
      expect(validateWorkspace(nestedPath)).to.equal(true);
      expect(validateWorkspace(testDir)).to.equal(false);
    });
  });

  describe("Debug Mode", function () {
    it("should detect debug mode from config", function () {
      // Initially, debug should be off
      expect(isDebugEnabled()).to.equal(false);

      // Create config with debug: true
      const testConfig = {
        workspaces: [],
        debug: true,
      };
      saveConfig(testConfig);

      // Now debug should be detected as enabled
      expect(isDebugEnabled()).to.equal(true);
    });
  });
});
