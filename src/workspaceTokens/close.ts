// Close workspace - cleanup and remove token

import * as fs from "fs";
import { removeDirectory } from "../fs/dirUtils.js";
import { logger } from "../logging/console-logger.js";
import { getTokenInfo, deleteToken } from "./store.js";

/**
 * Close a workspace token and clean up resources
 * @param workspaceToken The workspace token to close
 * @returns True if workspace token was closed, false if it didn't exist
 */
export function closeWorkspace(workspaceToken: string): boolean {
  const workspaceTokenInfo = getTokenInfo(workspaceToken);
  if (workspaceTokenInfo) {
    // Clean up temporary directory if one was created
    if (workspaceTokenInfo.isTempDir && fs.existsSync(workspaceTokenInfo.workingDir)) {
      try {
        removeDirectory(workspaceTokenInfo.workingDir);
      } catch (error) {
        logger.error("Error cleaning up temporary directory", error);
      }
    }

    // Remove the workspace token
    deleteToken(workspaceToken);
    return true;
  }
  return false;
}
