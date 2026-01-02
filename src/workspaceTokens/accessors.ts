// Workspace token accessors - query functions

import type { WorkspaceTokenInfo } from "./types.js";
import { getTokenInfo, hasToken, updateAccessTime, getActiveWorkspaceTokens } from "./store.js";

/**
 * Get the workspace name for a workspace token
 * @param workspaceToken The workspace token
 * @returns Workspace name or null if workspace token doesn't exist
 */
export function getWorkspaceNameForWorkspaceToken(workspaceToken: string): string | null {
  const tokenInfo = getTokenInfo(workspaceToken);
  if (tokenInfo) {
    updateAccessTime(workspaceToken);
    return tokenInfo.workspaceName;
  }
  return null;
}

/**
 * Get the working directory for a workspace token
 * @param workspaceToken The workspace token
 * @returns Working directory path or null if workspace token doesn't exist
 */
export function getWorkingDirForWorkspaceToken(workspaceToken: string): string | null {
  const tokenInfo = getTokenInfo(workspaceToken);
  if (tokenInfo) {
    updateAccessTime(workspaceToken);
    return tokenInfo.workingDir;
  }
  return null;
}

/**
 * Check if a workspace token exists
 * @param workspaceToken The workspace token to check
 * @returns True if the workspace token exists
 */
export function workspaceTokenExists(workspaceToken: string): boolean {
  const exists = hasToken(workspaceToken);
  if (exists) {
    updateAccessTime(workspaceToken);
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
  const tokenInfo = getTokenInfo(workspaceToken);
  if (tokenInfo) {
    updateAccessTime(workspaceToken);
    const { workspaceName, workingDir, isTempDir } = tokenInfo;
    return { workspaceName, workingDir, isTempDir };
  }
  return null;
}

// Testing functions
/**
 * Get the raw workspace token store - for testing only
 * @internal
 */
export function _getActiveWorkspaceTokens(): Record<string, WorkspaceTokenInfo> {
  return getActiveWorkspaceTokens();
}

/**
 * Set the last access time for a workspace token - for testing only
 * @internal
 */
export function _setWorkspaceTokenLastAccessTime(workspaceToken: string, time: number): boolean {
  const tokenInfo = getTokenInfo(workspaceToken);
  if (tokenInfo) {
    tokenInfo.lastAccessTime = time;
    return true;
  }
  return false;
}

/**
 * Set the idle timeout for a workspace token - for testing only
 * @internal
 */
export function _setWorkspaceTokenIdleTimeout(workspaceToken: string, timeout: number): boolean {
  const tokenInfo = getTokenInfo(workspaceToken);
  if (tokenInfo) {
    tokenInfo.idleTimeout = timeout;
    return true;
  }
  return false;
}
