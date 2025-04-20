// src/test/integration/docker/execution.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  checkContainerRunning,
  checkNetworkExists,
  executeDockerCommand,
} from "../../../docker/execution.js";
import {
  closeWorkspace,
  getWorkingDirForWorkspaceToken,
  openWorkspace,
} from "../../../workspaceTokens/workspaceTokenStore.js";
import { createTestConfig, setupTestEnvironment } from "../setup.js";
import {
  createNetwork,
  createTestContainer,
  createTestFile,
  isDockerAvailable,
  removeContainer,
  removeNetwork,
  uniqueName
} from "../testUtils.js";

describe("Docker Execution with Sessions", function () {
  this.timeout(30000); // Docker operations can be slow

  let configDir: string;
  let workspaceDir: string;
  let cleanup: () => void;
  let dockerAvailable = false;
  let containerName: string;
  let networkName: string;
  const projectName = "test-workspace";
  const dockerImage = "alpine:latest";

  before(async function () {
    // Check if Docker is available
    dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      console.warn("Docker not available. Docker tests will be skipped.");
    }
  });

  beforeEach(async function () {
    // Skip tests if Docker is not available
    if (!dockerAvailable) {
      this.skip();
      return;
    }

    // Setup test environment
    const env = setupTestEnvironment();
    configDir = env.configDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create unique names for container and network
    containerName = uniqueName("codebox-test-container");
    networkName = uniqueName("codebox-test-network");

    // Create a test file in the project directory
    createTestFile(
      path.join(workspaceDir, "test.txt"),
      "Hello from Docker test!"
    );

    // Create Docker network
    await createNetwork(networkName);
  });

  afterEach(async function () {
    if (dockerAvailable) {
      // Clean up Docker resources
      await removeContainer(containerName);
      await removeNetwork(networkName);
    }

    // Clean up test environment
    cleanup();
  });

  describe("Container Operations", function () {
    it("should check if a container is running", async function () {
      // Initially the container should not be running
      const initialCheck = await checkContainerRunning(containerName);
      expect(initialCheck).to.equal(false);

      // Start a container
      await createTestContainer(containerName, dockerImage, workspaceDir);

      // Now the container should be detected as running
      const runningCheck = await checkContainerRunning(containerName);
      expect(runningCheck).to.equal(true);
    });

    it("should check if a network exists", async function () {
      // The network should exist (created in beforeEach)
      const networkExists = await checkNetworkExists(networkName);
      expect(networkExists).to.equal(true);

      // Non-existent network should return false
      const nonExistentCheck = await checkNetworkExists("non-existent-network");
      expect(nonExistentCheck).to.equal(false);
    });
  });

  describe("Command Execution (Container Mode)", function () {
    beforeEach(async function () {
      // Create a test container
      await createTestContainer(containerName, dockerImage, workspaceDir);

      // Register the container in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: workspaceDir,
            containerName: containerName,
          },
        ],
      });
    });

    it("should execute commands in an existing container using session working directory", async function () {
      // Open a session for testing
      const workspaceToken = openWorkspace(projectName);
      expect(workspaceToken).to.not.equal(null);

      // Get the working directory from the session
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);
      expect(workingDir).to.equal(workspaceDir);

      // Execute command using workspace name and session working directory
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the session
      closeWorkspace(workspaceToken as string);
    });

    it("should handle command errors", async function () {
      // Open a session for testing
      const workspaceToken = openWorkspace(projectName);
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);

      try {
        await executeDockerCommand(
          projectName,
          "cat /nonexistent/file.txt",
          workingDir as string
        );
        // Should not reach here
        expect.fail("Command should have thrown an error");
      } catch (error: unknown) {
        expect((error as Error).message).to.include(
          "No such file or directory"
        );
      } finally {
        // Close the session
        closeWorkspace(workspaceToken as string);
      }
    });
  });

  describe("Command Execution (Image Mode)", function () {
    beforeEach(function () {
      // Register the image in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: workspaceDir,
            dockerImage: dockerImage,
          },
        ],
      });
    });

    it("should execute commands with a Docker image using session working directory", async function () {
      // Open a session for testing
      const workspaceToken = openWorkspace(projectName);
      expect(workspaceToken).to.not.equal(null);

      // Get the working directory from the session
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);
      expect(workingDir).to.equal(workspaceDir);

      // Execute command using workspace name and session working directory
      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /workspace/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the session
      closeWorkspace(workspaceToken as string);
    });

    it("should respect custom container path", async function () {
      // Update config with custom container path
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: workspaceDir,
            dockerImage: dockerImage,
            containerPath: "/custom-path",
          },
        ],
      });

      // Open a session for testing
      const workspaceToken = openWorkspace(projectName);
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);

      const { stdout } = await executeDockerCommand(
        projectName,
        "cat /custom-path/test.txt",
        workingDir as string
      );

      expect(stdout).to.include("Hello from Docker test!");

      // Close the session
      closeWorkspace(workspaceToken as string);
    });
  });

  describe("Network Support", function () {
    beforeEach(function () {
      // Register the image with network in the config
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: workspaceDir,
            dockerImage: dockerImage,
            network: networkName,
          },
        ],
      });
    });

    it("should use the specified network", async function () {
      // Open a session for testing
      const workspaceToken = openWorkspace(projectName);
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);

      try {
        // Just verify the Docker command includes the network parameter
        const { stdout } = await executeDockerCommand(
          projectName,
          "echo 'Testing network connection'",
          workingDir as string
        );

        // This just verifies the command succeeded - in a real scenario,
        // you would use services on the same network to verify connectivity
        expect(stdout).to.include("Testing network connection");
      } catch (error: unknown) {
        // If there's a network-related error, it will be caught here
        expect.fail(
          `Network connection test failed: ${(error as Error).message}`
        );
      } finally {
        // Close the session
        closeWorkspace(workspaceToken as string);
      }
    });
  });

  describe("Copy Mode", function () {
    beforeEach(function () {
      // Register the image in the config with copy mode enabled
      createTestConfig(configDir, {
        projects: [
          {
            name: projectName,
            hostPath: workspaceDir,
            dockerImage: dockerImage,
            copy: true,
          },
        ],
      });
    });

    it("should use a temporary directory when copy mode is enabled", async function () {
      // Open a session for testing with copy mode
      const workspaceToken = openWorkspace(projectName);
      expect(workspaceToken).to.not.equal(null);

      // Get the working directory from the session - should be a temp directory
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken as string);
      expect(workingDir).to.not.equal(workspaceDir); // Should be a different directory

      // Verify the temp directory contains the test file
      expect(
        fs.existsSync(path.join(workingDir as string, "test.txt"))
      ).to.equal(true);

      // Execute a command that modifies a file in the temp directory
      await executeDockerCommand(
        projectName,
        "echo 'Modified content' > /workspace/test.txt",
        workingDir as string
      );

      // Verify the file in temp directory was modified
      expect(
        fs.readFileSync(path.join(workingDir as string, "test.txt"), "utf8")
      ).to.include("Modified content");

      // Verify the original file was not modified
      expect(
        fs.readFileSync(path.join(workspaceDir, "test.txt"), "utf8")
      ).to.equal("Hello from Docker test!");

      // Create a new file in the temp directory
      await executeDockerCommand(
        projectName,
        "echo 'New file' > /workspace/new-file.txt",
        workingDir as string
      );

      // Verify the new file exists in temp directory
      expect(
        fs.existsSync(path.join(workingDir as string, "new-file.txt"))
      ).to.equal(true);

      // Verify the new file doesn't exist in the original directory
      expect(fs.existsSync(path.join(workspaceDir, "new-file.txt"))).to.equal(
        false
      );

      // Close the session - should clean up the temp directory
      closeWorkspace(workspaceToken as string);

      // Verify the temp directory has been cleaned up
      expect(fs.existsSync(workingDir as string)).to.equal(false);
    });

    it("should create separate temp directories for different sessions of the same workspace", async function () {
      // Open two sessions for the same project
      const sessionId1 = openWorkspace(projectName);
      const sessionId2 = openWorkspace(projectName);

      const workingDir1 = getWorkingDirForWorkspaceToken(sessionId1 as string);
      const workingDir2 = getWorkingDirForWorkspaceToken(sessionId2 as string);

      // Verify they are different directories
      expect(workingDir1).to.not.equal(workingDir2);

      // Modify file in first session
      await executeDockerCommand(
        projectName,
        "echo 'Modified in session 1' > /workspace/test.txt",
        workingDir1 as string
      );

      // Modify file in second session
      await executeDockerCommand(
        projectName,
        "echo 'Modified in session 2' > /workspace/test.txt",
        workingDir2 as string
      );

      // Verify changes are isolated to each session
      expect(
        fs.readFileSync(path.join(workingDir1 as string, "test.txt"), "utf8")
      ).to.include("Modified in session 1");
      expect(
        fs.readFileSync(path.join(workingDir2 as string, "test.txt"), "utf8")
      ).to.include("Modified in session 2");

      // Original file should be unchanged
      expect(
        fs.readFileSync(path.join(workspaceDir, "test.txt"), "utf8")
      ).to.equal("Hello from Docker test!");

      // Clean up
      closeWorkspace(sessionId1 as string);
      closeWorkspace(sessionId2 as string);
    });
  });
});
