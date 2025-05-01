// src/docker/execution.ts
import { exec } from "child_process";
import { promisify } from "util";
import { getWorkspaceByName } from "../config/workspaceConfig.js";

const execAsync = promisify(exec);

/**
 * Result of executing a command in Docker
 */
export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

/**
 * Get the UID/GID for Docker container execution
 */
export const uid = process.getuid?.();
export const gid = process.getgid?.();

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
      throw new Error(
        "No Docker image or container configured for this workspace"
      );
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

/**
 * Check if a Docker container exists and is running
 */
export async function checkContainerRunning(
  containerName: string
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker ps -q -f "name=^${containerName}$"`
    );
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Check if a Docker network exists
 */
export async function checkNetworkExists(
  networkName: string
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker network inspect ${networkName} --format "{{.Name}}"`
    );
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Apply template variables to a template
 */
function applyTemplateVariables(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      const regex = new RegExp(`{{${key}}}`, "g");
      result = result.replace(regex, String(value));
    }
  }
  return result;
}

/**
 * Execute command inside an existing Docker container
 */
async function executeInExistingContainer(
  containerName: string,
  command: string,
  workdir = "/workspace",
  execTemplate?: string
): Promise<ExecuteResult> {
  // Check if container is running
  if (!(await checkContainerRunning(containerName))) {
    throw new Error(`Container '${containerName}' not found or not running`);
  }

  // Escape quotes in the command
  const escapedCommand = command.replace(/"/g, '\\"');

  let dockerCommand: string;

  if (execTemplate) {
    // Use the provided template with variable substitution
    const templateVariables = {
      containerName,
      containerPath: workdir,
      command: escapedCommand,
      uid,
      gid,
    };

    dockerCommand = applyTemplateVariables(execTemplate, templateVariables);
  } else {
    // Use the default docker exec command format
    dockerCommand = `docker exec -i --user=${uid}:${gid} --workdir="${workdir}" ${containerName} /bin/sh -c "${escapedCommand}"`;
  }

  return await execAsync(dockerCommand, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
}

/**
 * Execute command in a new Docker container from an image
 */
async function executeWithDockerImage(
  image: string,
  path: string,
  command: string,
  containerPath = "/workspace",
  network?: string,
  runTemplate?: string
): Promise<ExecuteResult> {
  // Escape quotes in the command
  const escapedCommand = command.replace(/"/g, '\\"');

  let dockerCommand: string;

  if (runTemplate) {
    // Use the provided template with variable substitution
    const templateVariables = {
      image,
      path,
      containerPath,
      command: escapedCommand,
      network,
      uid,
      gid,
    };

    dockerCommand = applyTemplateVariables(runTemplate, templateVariables);
  } else {
    // Use the default docker command format
    // Add network parameter if specified
    const networkParam = network ? `--network="${network}"` : "";

    dockerCommand = `docker run -i --rm \
      ${networkParam} \
      -v "${path}:${containerPath}" \
      --workdir="${containerPath}" \
      --user=${uid}:${gid} \
      ${image} /bin/sh -c "${escapedCommand}"`;
  }

  return await execAsync(dockerCommand, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
}
