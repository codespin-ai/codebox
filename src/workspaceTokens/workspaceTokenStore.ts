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
 * Open a project and return a session ID
 * @param projectName The name of the project to open
 * @returns Session ID or null if project doesn't exist
 */
export function openProject(projectName: string): string | null {
  const project = getWorkspaceByName(projectName);
  if (!project) {
    return null;
  }

  // Generate a new session ID
  const sessionId = uuidv4();

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
  activeWorkspaceTokens[sessionId] = {
    projectName,
    workingDir,
    isTempDir,
  };

  return sessionId;
}

/**
 * Get the project name for a session ID
 * @param sessionId The session ID
 * @returns Project name or null if session doesn't exist
 */
export function getProjectNameForSession(sessionId: string): string | null {
  return activeWorkspaceTokens[sessionId]?.projectName || null;
}

/**
 * Get the working directory for a session
 * @param sessionId The session ID
 * @returns Working directory path or null if session doesn't exist
 */
export function getWorkingDirForSession(sessionId: string): string | null {
  return activeWorkspaceTokens[sessionId]?.workingDir || null;
}

/**
 * Check if a session exists
 * @param sessionId The session ID to check
 * @returns True if the session exists
 */
export function sessionExists(sessionId: string): boolean {
  return sessionId in activeWorkspaceTokens;
}

/**
 * Get full session information
 * @param sessionId The session ID
 * @returns Session information or null if not found
 */
export function getSessionInfo(sessionId: string): WorkspaceTokenInfo | null {
  return activeWorkspaceTokens[sessionId] || null;
}

/**
 * Close a session and clean up resources
 * @param workspaceToken The session ID to close
 * @returns True if session was closed, false if it didn't exist
 */
export function closeSession(workspaceToken: string): boolean {
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
