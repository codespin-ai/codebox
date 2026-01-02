// Workspace token store - in-memory storage and lookup

import type { WorkspaceTokenInfo } from "./types.js";

// In-memory store of active workspace tokens
const activeWorkspaceTokens: Record<string, WorkspaceTokenInfo> = {};

/**
 * Get the active workspace tokens store
 * @returns The active workspace tokens record
 */
export function getActiveWorkspaceTokens(): Record<string, WorkspaceTokenInfo> {
  return activeWorkspaceTokens;
}

/**
 * Get workspace token info by token
 * @param workspaceToken The workspace token
 * @returns Workspace token info or undefined
 */
export function getTokenInfo(workspaceToken: string): WorkspaceTokenInfo | undefined {
  return activeWorkspaceTokens[workspaceToken];
}

/**
 * Set workspace token info
 * @param workspaceToken The workspace token
 * @param info The workspace token info
 */
export function setTokenInfo(workspaceToken: string, info: WorkspaceTokenInfo): void {
  activeWorkspaceTokens[workspaceToken] = info;
}

/**
 * Delete a workspace token from the store
 * @param workspaceToken The workspace token to delete
 */
export function deleteToken(workspaceToken: string): void {
  delete activeWorkspaceTokens[workspaceToken];
}

/**
 * Check if a workspace token exists in the store
 * @param workspaceToken The workspace token
 * @returns True if exists
 */
export function hasToken(workspaceToken: string): boolean {
  return workspaceToken in activeWorkspaceTokens;
}

/**
 * Update the last access time for a workspace token
 * @param workspaceToken The workspace token to update
 */
export function updateAccessTime(workspaceToken: string): void {
  const tokenInfo = activeWorkspaceTokens[workspaceToken];
  if (tokenInfo) {
    tokenInfo.lastAccessTime = Date.now();
  }
}
