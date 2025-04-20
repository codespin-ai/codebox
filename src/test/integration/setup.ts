// src/test/integration/setup.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { install } from "source-map-support";
import { setConfigBasePath } from "../../config/workspaceConfig.js";
import { closeWorkspace, openWorkspace } from "../../workspaceTokens/workspaceTokenStore.js";

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
 * Creates a test workspace token for a workspace
 * @param workspaceName The name of the workspace
 * @returns Workspace Token or null
 */
export function openTestWorkspace(workspaceName: string): string | null {
  return openWorkspace(workspaceName);
}

/**
 * Closes a workspace
 * @param workspaceToken The workspace token to close
 */
export function closeTestWorkspace(workspaceToken: string): void {
  closeWorkspace(workspaceToken);
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

  // Create a workspace directory for testing
  const workspaceDir = path.join(testDir, "test-workspace");
  fs.mkdirSync(workspaceDir, { recursive: true });

  // Cleanup function
  const cleanup = () => {
    cleanupTestEnvironment(testDir);
  };

  return {
    testDir,
    configDir,
    workspaceDir,
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
