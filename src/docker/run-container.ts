// Execute command in new Docker container
import { exec } from "child_process";
import { promisify } from "util";
import type { ExecuteResult } from "./types.js";
import { applyTemplateVariables } from "./template.js";
import { uid, gid } from "./exec-container.js";

const execAsync = promisify(exec);

/**
 * Execute command in a new Docker container from an image
 */
export async function executeWithDockerImage(
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
