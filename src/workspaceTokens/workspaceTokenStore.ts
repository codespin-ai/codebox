// src/sessions/sessionStore.ts
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getWorkspaceByName } from "../config/workspaceConfig.js";
import {
  copyDirectory,
  createTempDirectory,
  removeDirectory,
} from "../fs/dirUtils.js";

// Session information including working directory
interface WorkspaceTokenInfo {
  projectName: string;
  workingDir: string; // Either original hostPath or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
}

// In-memory store of active sessions
const activeWorkspaceTokens: Record<string, WorkspaceTokenInfo> = {};

/**
 * Open a project and return a workspace token
 * @param projectName The name of the project to open
 * @returns Session ID or null if project doesn't exist
 */
export function openWorkspace(projectName: string): string | null {
  const project = getWorkspaceByName(projectName);
  if (!project) {
    return null;
  }

  // Generate a new workspace token
  const workspaceToken = uuidv4();

  let workingDir = project.hostPath;
  let isTempDir = false;

  // If copy is enabled, create a temporary directory and copy files
  if (project.copy) {
    try {
      const tempDir = createTempDirectory(`codebox-${projectName}-session-`);
      copyDirectory(project.hostPath, tempDir);
      workingDir = tempDir;
      isTempDir = true;
    } catch (error) {
      console.error(
        `Failed to create temporary directory for project ${projectName}:`,
        error
      );
      return null;
    }
  }

  // Store the session information
  activeWorkspaceTokens[workspaceToken] = {
    projectName,
    workingDir,
    isTempDir,
  };

  return workspaceToken;
}

/**
 * Get the workspace name for a workspace token
 * @param workspaceToken The workspace token
 * @returns Project name or null if session doesn't exist
 */
export function getWorkspaceNameForWorkspaceToken(workspaceToken: string): string | null {
  return activeWorkspaceTokens[workspaceToken]?.projectName || null;
}

/**
 * Get the working directory for a session
 * @param workspaceToken The workspace token
 * @returns Working directory path or null if session doesn't exist
 */
export function getWorkingDirForWorkspaceToken(workspaceToken: string): string | null {
  return activeWorkspaceTokens[workspaceToken]?.workingDir || null;
}

/**
 * Check if a session exists
 * @param workspaceToken The workspace token to check
 * @returns True if the session exists
 */
export function workspaceTokenExists(workspaceToken: string): boolean {
  return workspaceToken in activeWorkspaceTokens;
}

/**
 * Get full session information
 * @param workspaceToken The workspace token
 * @returns Session information or null if not found
 */
export function getWorkspaceTokenInfo(workspaceToken: string): WorkspaceTokenInfo | null {
  return activeWorkspaceTokens[workspaceToken] || null;
}

/**
 * Close a session and clean up resources
 * @param workspaceToken The workspace token to close
 * @returns True if session was closed, false if it didn't exist
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

    // Remove the session
    delete activeWorkspaceTokens[workspaceToken];
    return true;
  }
  return false;
}
