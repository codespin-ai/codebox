// Execute command in existing Docker container
import { exec } from "child_process";
import { promisify } from "util";
import type { ExecuteResult } from "./types.js";
import { applyTemplateVariables } from "./template.js";
import { checkContainerRunning } from "./container-check.js";

const execAsync = promisify(exec);

/**
 * Get the UID/GID for Docker container execution
 */
export const uid = process.getuid?.();
export const gid = process.getgid?.();

/**
 * Execute command inside an existing Docker container
 */
export async function executeInExistingContainer(
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
