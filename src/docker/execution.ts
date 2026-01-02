// Docker execution - main entry point
import { getWorkspaceByName } from "../config/workspaceConfig.js";
import type { ExecuteResult } from "./types.js";
import { executeInExistingContainer } from "./exec-container.js";
import { executeWithDockerImage } from "./run-container.js";

// Re-export types and utilities
export type { ExecuteResult } from "./types.js";
export { uid, gid } from "./exec-container.js";
export { checkContainerRunning, checkNetworkExists } from "./container-check.js";

/**
 * Execute a command in a Docker container based on workspace configuration
 * @param workspaceName Name of the workspace
 * @param command Command to execute
 * @param hostDir Working directory associated with the token
 */
export async function executeDockerCommand(
  workspaceName: string,
  command: string,
  hostDir: string
): Promise<ExecuteResult> {
  const workspace = getWorkspaceByName(workspaceName);
  if (!workspace) {
    throw new Error(`Workspace not registered: ${workspaceName}`);
  }

  try {
    if (workspace.containerName) {
      // Execute in existing container
      return await executeInExistingContainer(
        workspace.containerName,
        command,
        workspace.containerPath,
        workspace.execTemplate
      );
    } else if (workspace.image) {
      // Execute in new container from image
      return await executeWithDockerImage(
        workspace.image,
        hostDir,
        command,
        workspace.containerPath,
        workspace.network,
        workspace.runTemplate
      );
    } else {
      throw new Error("No Docker image or container configured for this workspace");
    }
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout || "";
    const stderr = (error as { stderr?: string }).stderr || "";
    const combinedOutput = `${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`;

    throw new Error(
      `Docker execution failed:\n${
        (error as Error).message ? (error as Error).message + "\n" : ""
      }${combinedOutput}`
    );
  }
}
