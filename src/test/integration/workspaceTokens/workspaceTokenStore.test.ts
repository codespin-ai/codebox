// src/test/integration/workspaceTokens/workspaceTokenStore.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  closeWorkspace,
  getWorkspaceNameForWorkspaceToken,
  getWorkingDirForWorkspaceToken,
  openWorkspace,
  workspaceTokenExists,
} from "../../../workspaceTokens/workspaceTokenStore.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import { createTestFile } from "../testUtils.js";

describe("Workspace token Store", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create a test file in the workspace directory
    createTestFile(path.join(workspaceDir, "test.txt"), "Original content");
  });

  afterEach(function () {
    cleanup();
  });

  describe("Open workspace", function () {
    it("should open a workspace token without copying files when copy=false", function () {
      // Register a workspace without copy mode
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
            copy: false,
          },
        ],
      });

      // Open a workspace
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");
      expect(workspaceToken).to.not.equal(undefined);
      expect(workspaceToken).to.not.equal(null);

      // Verify workspace token is registered
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Verify workspace name is correct
      expect(
        getWorkspaceNameForWorkspaceToken(workspaceToken as string)
      ).to.equal("test-workspace");

      // Verify working directory is the original workspace directory
      expect(getWorkingDirForWorkspaceToken(workspaceToken as string)).to.equal(
        workspaceDir
      );
    });

    it("should open a workspace token with copying files when copy=true", function () {
      // Register a workspace with copy mode
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a workspace
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");
      expect(workspaceToken).to.not.equal(undefined);
      expect(workspaceToken).to.not.equal(null);

      // Verify workspace token is registered
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Verify workspace name is correct
      expect(
        getWorkspaceNameForWorkspaceToken(workspaceToken as string)
      ).to.equal("test-workspace");

      // Verify working directory is not the original workspace directory
      const workingDir = getWorkingDirForWorkspaceToken(
        workspaceToken as string
      );
      expect(workingDir).to.not.equal(workspaceDir);

      // Verify the test file was copied to the temp directory
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.equal("Original content");
    });

    it("should return null for non-existent workspaces", function () {
      // Register a workspace
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
          },
        ],
      });

      // Try to open non-existent workspace
      const workspaceToken = openWorkspace("non-existent-workspace");
      expect(workspaceToken).to.equal(null);
    });
  });

  describe("Close workspace", function () {
    it("should close a workspace token and return true", function () {
      // Register a workspace
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
          },
        ],
      });

      // Open a workspace
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");

      // Close the workspace token
      const result = closeWorkspace(workspaceToken as string);
      expect(result).to.equal(true);

      // Verify workspace token no longer exists
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(false);
    });

    it("should return false for non-existentworkspace tokens", function () {
      const result = closeWorkspace("non-existent-workspace-token");
      expect(result).to.equal(false);
    });

    it("should clean up temporary directory when copy=true", function () {
      // Register a workspace with copy mode
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a workspace
      const workspaceToken = openWorkspace("test-workspace");
      const workingDir = getWorkingDirForWorkspaceToken(
        workspaceToken as string
      );

      // Verify temp directory exists
      expect(fs.existsSync(workingDir as string)).to.equal(true);

      // Close the workspace token
      closeWorkspace(workspaceToken as string);

      // Verify temp directory was removed
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });
  });

  describe("Workspace token Isolation", function () {
    it("should maintain isolated file changes betweenworkspace tokens with copy=true", function () {
      // Register a workspace with copy mode
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            path: workspaceDir,
            image: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open twoworkspace tokens for the same workspace
      const workspaceToken1 = openWorkspace("test-workspace");
      const workspaceToken2 = openWorkspace("test-workspace");

      const workingDir1 = getWorkingDirForWorkspaceToken(
        workspaceToken1 as string
      );
      const workingDir2 = getWorkingDirForWorkspaceToken(
        workspaceToken2 as string
      );

      // Verify working directories are different
      expect(workingDir1).to.not.equal(workingDir2);

      // Make changes in first workspace token
      fs.writeFileSync(
        path.join(workingDir1 as string, "test.txt"),
        "Modified in workspace token 1"
      );

      // Make changes in second workspace token
      fs.writeFileSync(
        path.join(workingDir2 as string, "test.txt"),
        "Modified in workspace token 2"
      );

      // Verify changes are isolated
      expect(
        fs.readFileSync(path.join(workingDir1 as string, "test.txt"), "utf8")
      ).to.equal("Modified in workspace token 1");
      expect(
        fs.readFileSync(path.join(workingDir2 as string, "test.txt"), "utf8")
      ).to.equal("Modified in workspace token 2");

      // Verify original file is unchanged
      expect(
        fs.readFileSync(path.join(workspaceDir, "test.txt"), "utf8")
      ).to.equal("Original content");

      // Clean up
      closeWorkspace(workspaceToken1 as string);
      closeWorkspace(workspaceToken2 as string);
    });
  });
});
