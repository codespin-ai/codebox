// src/test/integration/config/projectConfig.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  getConfig,
  getConfigFilePath,
  getWorkspaceByName,
  isDebugEnabled,
  saveConfig,
  validateProject,
  validateWorkspaceName,
} from "../../../config/workspaceConfig.js";
import { setupTestEnvironment } from "../setup.js";

describe("Workspace Configuration", function () {
  let testDir: string;
  let projectDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    projectDir = env.projectDir;
    cleanup = env.cleanup;
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("getConfig and saveConfig", function () {
    it("should return an empty config when no config file exists", function () {
      const config = getConfig();
      expect(config).to.deep.equal({ projects: [] });
    });

    it("should save and read the config file correctly", function () {
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: projectDir,
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
    it("should find a project by name", function () {
      // Create test config with a project
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: projectDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Test getProjectByName
      const project = getWorkspaceByName("test-workspace");
      expect(project).to.not.equal(null);
      expect(project?.name).to.equal("test-workspace");

      // Test non-existent project
      const nonExistent = getWorkspaceByName("non-existent");
      expect(nonExistent).to.equal(null);
    });

    it("should validate project names", function () {
      // Create test config with a project
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: projectDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Test validateProjectName
      expect(validateWorkspaceName("test-workspace")).to.equal(true);
      expect(validateWorkspaceName("non-existent")).to.equal(false);
    });

    it("should validate project directories", function () {
      // Create test config with a project
      const testConfig = {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: projectDir,
            dockerImage: "node:18",
          },
        ],
      };
      saveConfig(testConfig);

      // Create a file in the project directory
      const nestedPath = path.join(projectDir, "nested");
      fs.mkdirSync(nestedPath, { recursive: true });

      // Test validateProject with various paths
      expect(validateProject(projectDir)).to.equal(true);
      expect(validateProject(nestedPath)).to.equal(true);
      expect(validateProject(testDir)).to.equal(false);
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
