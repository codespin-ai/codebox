// Open workspace - create workspace token

import { v4 as uuidv4 } from "uuid";
import { getWorkspaceByName } from "../config/workspaceConfig.js";
import { copyDirectory, createTempDirectory } from "../fs/dirUtils.js";
import { logger } from "../logging/console-logger.js";
import { DEFAULT_IDLE_TIMEOUT } from "./types.js";
import { setTokenInfo } from "./store.js";

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
      const tempDir = createTempDirectory(`codebox-${workspaceName}-workspace-token-`);
      copyDirectory(workspace.path, tempDir);
      workingDir = tempDir;
      isTempDir = true;
    } catch (error) {
      logger.error(`Failed to create temporary directory for workspace ${workspaceName}`, error);
      return null;
    }
  }

  // Get the idle timeout, defaulting to DEFAULT_IDLE_TIMEOUT if not specified
  const idleTimeout =
    workspace.idleTimeout !== undefined ? workspace.idleTimeout : DEFAULT_IDLE_TIMEOUT;

  // Store the workspace token information
  setTokenInfo(workspaceToken, {
    workspaceName: workspaceName,
    workingDir,
    isTempDir,
    lastAccessTime: Date.now(),
    idleTimeout,
  });

  return workspaceToken;
}
