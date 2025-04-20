// src/sessions/sessionStore.ts
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceByName } from "../config/workspaceConfig.js";
import {
  copyDirectory,
  createTempDirectory,
  removeDirectory,
} from "../fs/dirUtils.js";

// Workspace token information including working directory
interface WorkspaceTokenInfo {
  workspaceName: string;
  workingDir: string; // Either original hostPath or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
}

// In-memory store of activeworkspace tokens
const activeWorkspaceTokens: Record<string, WorkspaceTokenInfo> = {};

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

  let workingDir = workspace.hostPath;
  let isTempDir = false;

  // If copy is enabled, create a temporary directory and copy files
  if (workspace.copy) {
    try {
      const tempDir = createTempDirectory(`codebox-${workspaceName}-workspace-token-`);
      copyDirectory(workspace.hostPath, tempDir);
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

  // Store the workspace token information
  activeWorkspaceTokens[workspaceToken] = {
    workspaceName: workspaceName,
    workingDir,
    isTempDir,
  };

  return workspaceToken;
}

/**
 * Get the workspace name for a workspace token
 * @param workspaceToken The workspace token
 * @returns Workspace name or null if workspace token doesn't exist
 */
export function getWorkspaceNameForWorkspaceToken(workspaceToken: string): string | null {
  return activeWorkspaceTokens[workspaceToken]?.workspaceName || null;
}

/**
 * Get the working directory for a workspace token
 * @param workspaceToken The workspace token
 * @returns Working directory path or null if workspace token doesn't exist
 */
export function getWorkingDirForWorkspaceToken(workspaceToken: string): string | null {
  return activeWorkspaceTokens[workspaceToken]?.workingDir || null;
}

/**
 * Check if a workspace token exists
 * @param workspaceToken The workspace token to check
 * @returns True if the workspace token exists
 */
export function workspaceTokenExists(workspaceToken: string): boolean {
  return workspaceToken in activeWorkspaceTokens;
}

/**
 * Get full workspace token information
 * @param workspaceToken The workspace token
 * @returns Workspace token information or null if not found
 */
export function getWorkspaceTokenInfo(workspaceToken: string): WorkspaceTokenInfo | null {
  return activeWorkspaceTokens[workspaceToken] || null;
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
    if (workspaceTokenInfo.isTempDir && fs.existsSync(workspaceTokenInfo.workingDir)) {
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
