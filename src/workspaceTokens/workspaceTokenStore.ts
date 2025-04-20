// src/sessions/sessionStore.ts
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { getProjectByName } from "../config/workspaceConfig.js";
import {
  copyDirectory,
  createTempDirectory,
  removeDirectory,
} from "../fs/dirUtils.js";

// Session information including working directory
interface SessionInfo {
  projectName: string;
  workingDir: string; // Either original hostPath or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
}

// In-memory store of active sessions
const activeSessions: Record<string, SessionInfo> = {};

/**
 * Open a project and return a session ID
 * @param projectName The name of the project to open
 * @returns Session ID or null if project doesn't exist
 */
export function openProject(projectName: string): string | null {
  const project = getProjectByName(projectName);
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
  activeSessions[sessionId] = {
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
  return activeSessions[sessionId]?.projectName || null;
}

/**
 * Get the working directory for a session
 * @param sessionId The session ID
 * @returns Working directory path or null if session doesn't exist
 */
export function getWorkingDirForSession(sessionId: string): string | null {
  return activeSessions[sessionId]?.workingDir || null;
}

/**
 * Check if a session exists
 * @param sessionId The session ID to check
 * @returns True if the session exists
 */
export function sessionExists(sessionId: string): boolean {
  return sessionId in activeSessions;
}

/**
 * Get full session information
 * @param sessionId The session ID
 * @returns Session information or null if not found
 */
export function getSessionInfo(sessionId: string): SessionInfo | null {
  return activeSessions[sessionId] || null;
}

/**
 * Close a session and clean up resources
 * @param sessionId The session ID to close
 * @returns True if session was closed, false if it didn't exist
 */
export function closeSession(sessionId: string): boolean {
  if (sessionId in activeSessions) {
    const sessionInfo = activeSessions[sessionId];

    // Clean up temporary directory if one was created
    if (sessionInfo.isTempDir && fs.existsSync(sessionInfo.workingDir)) {
      try {
        removeDirectory(sessionInfo.workingDir);
      } catch (error) {
        console.error(`Error cleaning up temporary directory: ${error}`);
      }
    }

    // Remove the session
    delete activeSessions[sessionId];
    return true;
  }
  return false;
}
