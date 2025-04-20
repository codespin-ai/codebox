// src/test/integration/setup.ts
import { install } from "source-map-support";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { setConfigBasePath } from "../../config/workspaceConfig.js";
import { openProject, closeSession } from "../../workspaceTokens/workspaceTokenStore.js";

// Install source map support for better error stack traces
install();

/**
 * Creates a temporary test environment directory
 * @returns Path to the temporary directory
 */
export function createTestEnvironment(): string {
  const tempDir = path.join(os.tmpdir(), `codebox-test-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Creates a test session for a project
 * @param projectName The name of the project
 * @returns Session ID or null
 */
export function createTestSession(projectName: string): string | null {
  return openProject(projectName);
}

/**
 * Closes a test session
 * @param workspaceToken The session ID to close
 */
export function closeTestSession(workspaceToken: string): void {
  closeSession(workspaceToken);
}

/**
 * Sets up a test environment with its own configuration path
 * @returns Object with test paths and cleanup function
 */
export function setupTestEnvironment() {
  const testDir = createTestEnvironment();

  // Configure application to use this test directory instead of user's home
  setConfigBasePath(testDir);

  // Create config directory structure
  const configDir = path.join(testDir, ".codespin");
  fs.mkdirSync(configDir, { recursive: true });

  // Create a project directory for testing
  const projectDir = path.join(testDir, "test-workspace");
  fs.mkdirSync(projectDir, { recursive: true });

  // Cleanup function
  const cleanup = () => {
    cleanupTestEnvironment(testDir);
  };

  return {
    testDir,
    configDir,
    projectDir,
    cleanup,
  };
}

/**
 * Recursively delete a directory
 */
function rmdir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // Recursive call for directories
        rmdir(curPath);
      } else {
        // Delete files
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

/**
 * Cleans up a test environment
 */
export function cleanupTestEnvironment(testDir: string): void {
  try {
    rmdir(testDir);
  } catch (error) {
    console.error(`Failed to clean up test directory: ${error}`);
  }
}

/**
 * Creates a test configuration file
 */
export function createTestConfig(
  configDir: string,
  config: Record<string, unknown>
): void {
  const configFile = path.join(configDir, "codebox.json");
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
}
