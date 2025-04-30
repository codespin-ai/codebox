// src/workspaceTokens/workspaceTokenStore.ts
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceByName } from "../config/workspaceConfig.js";
import {
  copyDirectory,
  createTempDirectory,
  removeDirectory,
} from "../fs/dirUtils.js";

// Default idle timeout (10 minutes in milliseconds)
const DEFAULT_IDLE_TIMEOUT = 600000;

// Workspace token information including working directory
interface WorkspaceTokenInfo {
  workspaceName: string;
  workingDir: string; // Either original path or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
  lastAccessTime: number; // Timestamp of last access
  idleTimeout: number; // Timeout in ms before auto-closing (0 means disabled)
}

// In-memory store of activeworkspace tokens
const activeWorkspaceTokens: Record<string, WorkspaceTokenInfo> = {};

// Timer reference for the cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the idle workspace cleanup process
 * @param checkInterval How often to check for idle workspaces (in ms)
 */
export function startIdleWorkspaceCleanup(checkInterval = 60000): void {
  // Clear any existing interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Set up new interval
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    checkAndCloseIdleWorkspaces(now);
  }, checkInterval);

  // Ensure the interval doesn't keep the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Check for and close idle workspaces
 * @param currentTime The current time to use for comparison (defaults to Date.now())
 * @returns Array of closed workspace token IDs
 */
export function checkAndCloseIdleWorkspaces(
  currentTime = Date.now()
): string[] {
  const tokensToClose: string[] = [];

  // Check each workspace token
  for (const [token, info] of Object.entries(activeWorkspaceTokens)) {
    // Skip workspaces that have disabled auto-close (idleTimeout = 0)
    if (info.idleTimeout === 0) continue;

    const idleTime = currentTime - info.lastAccessTime;
    if (idleTime >= info.idleTimeout) {
      tokensToClose.push(token);
    }
  }

  // Close idle workspaces
  for (const token of tokensToClose) {
    try {
      console.log(`Auto-closing idle workspace token: ${token}`);
      closeWorkspace(token);
    } catch (error) {
      console.error(`Error closing workspace token ${token}:`, error);
    }
  }

  return tokensToClose;
}

/**
 * Stop the idle workspace cleanup process
 */
export function stopIdleWorkspaceCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Update the last access time for a workspace token
 * @param workspaceToken The workspace token to update
 */
export function updateWorkspaceTokenAccessTime(workspaceToken: string): void {
  if (workspaceToken in activeWorkspaceTokens) {
    activeWorkspaceTokens[workspaceToken].lastAccessTime = Date.now();
  }
}

/**
 * Open a workspace and return a workspace token
 * @param workspaceName The name of the workspace to open
 * @returns Workspace token or null if workspace doesn't exist
 */
export function openWorkspace(workspaceName: string): string | null {
  const workspace = getWorkspaceByName(workspaceName);
  if (!workspace) {
    return null;
  }

  // Generate a new workspace token
  const workspaceToken = uuidv4();

  let workingDir = workspace.path;
  let isTempDir = false;

  // If copy is enabled, create a temporary directory and copy files
  if (workspace.copy) {
    try {
      const tempDir = createTempDirectory(
        `codebox-${workspaceName}-workspace-token-`
      );
      copyDirectory(workspace.path, tempDir);
      workingDir = tempDir;
      isTempDir = true;
    } catch (error) {
      console.error(
        `Failed to create temporary directory for workspace ${workspaceName}:`,
        error
      );
      return null;
    }
  }

  // Get the idle timeout, defaulting to DEFAULT_IDLE_TIMEOUT if not specified
  const idleTimeout =
    workspace.idleTimeout !== undefined
      ? workspace.idleTimeout
      : DEFAULT_IDLE_TIMEOUT;

  // Store the workspace token information
  activeWorkspaceTokens[workspaceToken] = {
    workspaceName: workspaceName,
    workingDir,
    isTempDir,
    lastAccessTime: Date.now(),
    idleTimeout,
  };

  return workspaceToken;
}

/**
 * Get the workspace name for a workspace token
 * @param workspaceToken The workspace token
 * @returns Workspace name or null if workspace token doesn't exist
 */
export function getWorkspaceNameForWorkspaceToken(
  workspaceToken: string
): string | null {
  if (workspaceToken in activeWorkspaceTokens) {
    updateWorkspaceTokenAccessTime(workspaceToken);
    return activeWorkspaceTokens[workspaceToken].workspaceName;
  }
  return null;
}

/**
 * Get the working directory for a workspace token
 * @param workspaceToken The workspace token
 * @returns Working directory path or null if workspace token doesn't exist
 */
export function getWorkingDirForWorkspaceToken(
  workspaceToken: string
): string | null {
  if (workspaceToken in activeWorkspaceTokens) {
    updateWorkspaceTokenAccessTime(workspaceToken);
    return activeWorkspaceTokens[workspaceToken].workingDir;
  }
  return null;
}

/**
 * Check if a workspace token exists
 * @param workspaceToken The workspace token to check
 * @returns True if the workspace token exists
 */
export function workspaceTokenExists(workspaceToken: string): boolean {
  const exists = workspaceToken in activeWorkspaceTokens;
  if (exists) {
    updateWorkspaceTokenAccessTime(workspaceToken);
  }
  return exists;
}

/**
 * Get full workspace token information
 * @param workspaceToken The workspace token
 * @returns Workspace token information or null if not found
 */
export function getWorkspaceTokenInfo(
  workspaceToken: string
): Omit<WorkspaceTokenInfo, "lastAccessTime" | "idleTimeout"> | null {
  if (workspaceToken in activeWorkspaceTokens) {
    updateWorkspaceTokenAccessTime(workspaceToken);
    const { workspaceName, workingDir, isTempDir } =
      activeWorkspaceTokens[workspaceToken];
    return { workspaceName, workingDir, isTempDir };
  }
  return null;
}

/**
 * Close a workspace token and clean up resources
 * @param workspaceToken The workspace token to close
 * @returns True if workspace token was closed, false if it didn't exist
 */
export function closeWorkspace(workspaceToken: string): boolean {
  if (workspaceToken in activeWorkspaceTokens) {
    const workspaceTokenInfo = activeWorkspaceTokens[workspaceToken];

    // Clean up temporary directory if one was created
    if (
      workspaceTokenInfo.isTempDir &&
      fs.existsSync(workspaceTokenInfo.workingDir)
    ) {
      try {
        removeDirectory(workspaceTokenInfo.workingDir);
      } catch (error) {
        console.error(`Error cleaning up temporary directory: ${error}`);
      }
    }

    // Remove the workspace token
    delete activeWorkspaceTokens[workspaceToken];
    return true;
  }
  return false;
}

// Testing functions
/**
 * Get the raw workspace token store - for testing only
 * @internal
 */
export function _getActiveWorkspaceTokens(): Record<
  string,
  WorkspaceTokenInfo
> {
  return activeWorkspaceTokens;
}

/**
 * Set the last access time for a workspace token - for testing only
 * @internal
 */
export function _setWorkspaceTokenLastAccessTime(
  workspaceToken: string,
  time: number
): boolean {
  if (workspaceToken in activeWorkspaceTokens) {
    activeWorkspaceTokens[workspaceToken].lastAccessTime = time;
    return true;
  }
  return false;
}

/**
 * Set the idle timeout for a workspace token - for testing only
 * @internal
 */
export function _setWorkspaceTokenIdleTimeout(
  workspaceToken: string,
  timeout: number
): boolean {
  if (workspaceToken in activeWorkspaceTokens) {
    activeWorkspaceTokens[workspaceToken].idleTimeout = timeout;
    return true;
  }
  return false;
}
