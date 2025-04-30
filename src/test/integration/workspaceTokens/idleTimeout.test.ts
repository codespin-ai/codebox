// src/test/integration/workspaceTokens/idleTimeout.test.ts
import { expect } from "chai";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import {
  openWorkspace,
  closeWorkspace,
  workspaceTokenExists,
  checkAndCloseIdleWorkspaces,
  _setWorkspaceTokenLastAccessTime,
  _setWorkspaceTokenIdleTimeout,
} from "../../../workspaceTokens/workspaceTokenStore.js";

describe("Workspace Idle Timeout", function () {
  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;
  });

  afterEach(function () {
    cleanup();
  });

  describe("Auto-closing idle workspaces", function () {
    it("should close workspace tokens that have exceeded their idle timeout", function () {
      // Register a workspace with a 5-minute idle timeout
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "idle-workspace",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 300000, // 5 minutes
          },
        ],
      });

      // Open a workspace token
      const workspaceToken = openWorkspace("idle-workspace");
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Set the last access time to 6 minutes ago (360,000 ms)
      const now = Date.now();
      _setWorkspaceTokenLastAccessTime(workspaceToken as string, now - 360000);

      // Run the idle check with the current time
      const closedTokens = checkAndCloseIdleWorkspaces(now);

      // Verify the workspace token was closed
      expect(closedTokens).to.include(workspaceToken);
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(false);
    });

    it("should not close workspace tokens that haven't exceeded their idle timeout", function () {
      // Register a workspace with a 5-minute idle timeout
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "active-workspace",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 300000, // 5 minutes
          },
        ],
      });

      // Open a workspace token
      const workspaceToken = openWorkspace("active-workspace");
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Set the last access time to 4 minutes ago (240,000 ms)
      const now = Date.now();
      _setWorkspaceTokenLastAccessTime(workspaceToken as string, now - 240000);

      // Run the idle check with the current time
      const closedTokens = checkAndCloseIdleWorkspaces(now);

      // Verify the workspace token was NOT closed
      expect(closedTokens).to.not.include(workspaceToken);
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Clean up
      closeWorkspace(workspaceToken as string);
    });

    it("should never close workspace tokens with idle timeout set to 0", function () {
      // Register a workspace with disabled idle timeout
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "disabled-timeout-workspace",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 0, // Disabled
          },
        ],
      });

      // Open a workspace token
      const workspaceToken = openWorkspace("disabled-timeout-workspace");
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Set the last access time to 1 hour ago (3,600,000 ms)
      const now = Date.now();
      _setWorkspaceTokenLastAccessTime(workspaceToken as string, now - 3600000);

      // Run the idle check with the current time
      const closedTokens = checkAndCloseIdleWorkspaces(now);

      // Verify the workspace token was NOT closed
      expect(closedTokens).to.not.include(workspaceToken);
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Clean up
      closeWorkspace(workspaceToken as string);
    });

    it("should use the default timeout (10 minutes) when not specified", function () {
      // Register a workspace without specifying an idle timeout
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "default-timeout-workspace",
            path: workspaceDir,
            dockerImage: "dummy-image",
            // No idleTimeout specified
          },
        ],
      });

      // Open a workspace token
      const workspaceToken = openWorkspace("default-timeout-workspace");
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(true);

      // Set the last access time to 11 minutes ago (660,000 ms)
      const now = Date.now();
      _setWorkspaceTokenLastAccessTime(workspaceToken as string, now - 660000);

      // Run the idle check with the current time
      const closedTokens = checkAndCloseIdleWorkspaces(now);

      // Verify the workspace token was closed (using default 10 minute timeout)
      expect(closedTokens).to.include(workspaceToken);
      expect(workspaceTokenExists(workspaceToken as string)).to.equal(false);
    });

    it("should respect different timeout values for different workspaces", function () {
      // Register workspaces with different timeouts
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "short-timeout",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 60000, // 1 minute
          },
          {
            name: "long-timeout",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 3600000, // 1 hour
          },
        ],
      });

      // Open workspace tokens
      const shortToken = openWorkspace("short-timeout");
      const longToken = openWorkspace("long-timeout");

      // Set last access time to 5 minutes ago (300,000 ms)
      const now = Date.now();
      _setWorkspaceTokenLastAccessTime(shortToken as string, now - 300000);
      _setWorkspaceTokenLastAccessTime(longToken as string, now - 300000);

      // Run the idle check
      const closedTokens = checkAndCloseIdleWorkspaces(now);

      // Verify only the short timeout workspace was closed
      expect(closedTokens).to.include(shortToken);
      expect(closedTokens).to.not.include(longToken);
      expect(workspaceTokenExists(shortToken as string)).to.equal(false);
      expect(workspaceTokenExists(longToken as string)).to.equal(true);

      // Clean up
      closeWorkspace(longToken as string);
    });

    it("should update workspace access time when used", function () {
      // Register a workspace
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "access-test",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 60000, // 1 minute
          },
        ],
      });

      // Open workspace token
      const token = openWorkspace("access-test");

      // Set last access time to 2 minutes ago
      const twoMinutesAgo = Date.now() - 120000;
      _setWorkspaceTokenLastAccessTime(token as string, twoMinutesAgo);

      // Access the workspace (which should update the access time)
      expect(workspaceTokenExists(token as string)).to.equal(true);

      // Run idle check
      const closedTokens = checkAndCloseIdleWorkspaces();

      // It should not be closed because the access time was updated
      expect(closedTokens).to.not.include(token);
      expect(workspaceTokenExists(token as string)).to.equal(true);

      // Now override the access time again
      _setWorkspaceTokenLastAccessTime(token as string, twoMinutesAgo);

      // Run idle check without accessing the workspace
      const closedTokens2 = checkAndCloseIdleWorkspaces();

      // It should be closed now
      expect(closedTokens2).to.include(token);
      expect(workspaceTokenExists(token as string)).to.equal(false);
    });
  });

  describe("Custom timeout values", function () {
    it("should allow changing the idle timeout for an existing workspace token", function () {
      // Register a workspace
      createTestConfig(configDir, {
        workspaces: [
          {
            name: "changing-timeout",
            path: workspaceDir,
            dockerImage: "dummy-image",
            idleTimeout: 300000, // 5 minutes
          },
        ],
      });

      // Open workspace token
      const token = openWorkspace("changing-timeout");

      // Set last access time to 2 minutes ago
      const now = Date.now();
      const twoMinutesAgo = now - 120000;
      _setWorkspaceTokenLastAccessTime(token as string, twoMinutesAgo);

      // Verify it's not closed with the 5-minute timeout
      const closedTokens = checkAndCloseIdleWorkspaces(now);
      expect(closedTokens).to.not.include(token);

      // Change the timeout to 1 minute
      _setWorkspaceTokenIdleTimeout(token as string, 60000);

      // Now it should be closed
      const closedTokens2 = checkAndCloseIdleWorkspaces(now);
      expect(closedTokens2).to.include(token);
      expect(workspaceTokenExists(token as string)).to.equal(false);
    });
  });
});
