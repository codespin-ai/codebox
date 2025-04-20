// src/test/integration/sessions/sessionStore.test.ts
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

describe("Workspace Token Store", function () {
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

  describe("openProject", function () {
    it("should open a session without copying files when copy=false", function () {
      // Register a project without copy mode
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
            copy: false,
          },
        ],
      });

      // Open a session
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");
      expect(workspaceToken).to.not.equal(undefined);
      expect(workspaceToken).to.not.equal(null);

      // Verify session is registered
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Verify workspace name is correct
      expect(getWorkspaceNameForWorkspaceToken(workspaceToken as string)).to.equal(
        "test-workspace"
      );

      // Verify working directory is the original project directory
      expect(getWorkingDirForWorkspaceToken(workspaceToken as string)).to.equal(workspaceDir);
    });

    it("should open a session with copying files when copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a session
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");
      expect(workspaceToken).to.not.equal(undefined);
      expect(workspaceToken).to.not.equal(null);

      // Verify session is registered
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Verify workspace name is correct
      expect(getWorkspaceNameForWorkspaceToken(workspaceToken as string)).to.equal(
        "test-workspace"
      );

      // Verify working directory is not the original project directory
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);
      expect(workingDir).to.not.equal(workspaceDir);

      // Verify the test file was copied to the temp directory
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.equal("Original content");
    });

    it("should return null for non-existent projects", function () {
      // Register a project
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
          },
        ],
      });

      // Try to open non-existent project
      const workspaceToken = openWorkspace("non-existent-workspace");
      expect(workspaceToken).to.equal(null);
    });
  });

  describe("closeSession", function () {
    it("should close a session and return true", function () {
      // Register a project
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
          },
        ],
      });

      // Open a session
      const workspaceToken = openWorkspace("test-workspace");
      expect(workspaceToken).to.be.a("string");

      // Close the session
      const result = closeWorkspace(workspaceToken as string);
      expect(result).to.equal(true);

      // Verify session no longer exists
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(false);
    });

    it("should return false for non-existent sessions", function () {
      const result = closeWorkspace("non-existent-session");
      expect(result).to.equal(false);
    });

    it("should clean up temporary directory when copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open a session
      const workspaceToken = openWorkspace("test-workspace");
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);

      // Verify temp directory exists
      expect(fs.existsSync(workingDir as string)).to.equal(true);

      // Close the session
      closeWorkspace(workspaceToken as string);

      // Verify temp directory was removed
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });
  });

  describe("Workspace Token Isolation", function () {
    it("should maintain isolated file changes between sessions with copy=true", function () {
      // Register a project with copy mode
      createTestConfig(configDir, {
        projects: [
          {
            name: "test-workspace",
            hostPath: workspaceDir,
            dockerImage: "dummy-image",
            copy: true,
          },
        ],
      });

      // Open two sessions for the same project
      const sessionId1 = openWorkspace("test-workspace");
      const sessionId2 = openWorkspace("test-workspace");

      const workingDir1 = getWorkingDirForWorkspaceToken(sessionId1 as string);
      const workingDir2 = getWorkingDirForWorkspaceToken(sessionId2 as string);

      // Verify working directories are different
      expect(workingDir1).to.not.equal(workingDir2);

      // Make changes in first session
      fs.writeFileSync(
        path.join(workingDir1 as string, "test.txt"),
        "Modified in session 1"
      );

      // Make changes in second session
      fs.writeFileSync(
        path.join(workingDir2 as string, "test.txt"),
        "Modified in session 2"
      );

      // Verify changes are isolated
      expect(
        fs.readFileSync(path.join(workingDir1 as string, "test.txt"), "utf8")
      ).to.equal("Modified in session 1");
      expect(
        fs.readFileSync(path.join(workingDir2 as string, "test.txt"), "utf8")
      ).to.equal("Modified in session 2");

      // Verify original file is unchanged
      expect(
        fs.readFileSync(path.join(workspaceDir, "test.txt"), "utf8")
      ).to.equal("Original content");

      // Clean up
      closeWorkspace(sessionId1 as string);
      closeWorkspace(sessionId2 as string);
    });
  });
});
