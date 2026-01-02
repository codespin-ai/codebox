// Add workspace command

import { exec } from "child_process";
import * as path from "path";
import { promisify } from "util";
import { getConfig, saveConfig } from "../../../config/workspaceConfig.js";
import { validateDirectory } from "../../../fs/pathValidation.js";
import type { WorkspaceOptions, CommandContext } from "./types.js";
import { print, printWarning } from "./utils.js";

const execAsync = promisify(exec);

export async function addWorkspace(
  options: WorkspaceOptions,
  context: CommandContext
): Promise<void> {
  const {
    dirname = ".",
    image,
    containerName,
    name,
    containerPath,
    network,
    copy = false,
    idleTimeout,
    runTemplate,
    execTemplate,
  } = options;

  if (!image && !containerName) {
    throw new Error("Either Docker image (--image) or container name (--container) is required");
  }

  // Resolve to absolute path
  const workspacePath = path.resolve(context.workingDir, dirname);

  // Check if directory exists and is a directory
  validateDirectory(workspacePath);

  // Extract workspace name from the path if not provided
  const workspaceName = name || path.basename(workspacePath);

  // Verify container exists if specified
  if (containerName) {
    try {
      const { stdout } = await execAsync(`docker ps -q -f "name=^${containerName}$"`);
      if (!stdout.trim()) {
        printWarning(
          `Container '${containerName}' not found or not running. Commands will fail until container is available.`
        );
      }
    } catch (_error) {
      printWarning(`Could not verify container '${containerName}'. Make sure Docker is running.`);
    }
  }

  // Verify network exists if specified
  if (network) {
    try {
      const { stdout } = await execAsync(`docker network inspect ${network} --format "{{.Name}}"`);
      if (!stdout.trim()) {
        printWarning(
          `Network '${network}' not found. Commands may fail until network is available.`
        );
      }
    } catch (_error) {
      printWarning(`Could not verify network '${network}'. Make sure Docker is running.`);
    }
  }

  // Get existing config
  const config = getConfig();

  // Check if workspace already exists by name
  const existingIndex = config.workspaces.findIndex((p) => p.name === workspaceName);

  if (existingIndex !== -1) {
    const existing = config.workspaces[existingIndex];
    if (!existing) {
      throw new Error("Workspace not found at expected index");
    }
    // Update existing workspace's configuration
    if (image) {
      existing.image = image;
    }
    if (containerName) {
      existing.containerName = containerName;
    }
    if (containerPath) {
      existing.containerPath = containerPath;
    }
    if (network) {
      existing.network = network;
    }
    // Update copy setting
    existing.copy = copy;
    // Update idle timeout if specified
    if (idleTimeout !== undefined) {
      existing.idleTimeout = idleTimeout;
    }
    // Update run template if specified
    if (runTemplate !== undefined) {
      existing.runTemplate = runTemplate;
    }
    // Update exec template if specified
    if (execTemplate !== undefined) {
      existing.execTemplate = execTemplate;
    }
    existing.path = workspacePath;
    saveConfig(config);
    print(`Updated workspace: ${workspaceName}`);
  } else {
    // Add new workspace
    config.workspaces.push({
      name: workspaceName,
      path: workspacePath,
      ...(containerPath && { containerPath }),
      ...(image && { image: image }),
      ...(containerName && { containerName }),
      ...(network && { network }),
      ...(copy && { copy: true }),
      ...(idleTimeout !== undefined && { idleTimeout }),
      ...(runTemplate !== undefined && { runTemplate }),
      ...(execTemplate !== undefined && { execTemplate }),
    });
    saveConfig(config);
    print(`Added workspace: ${workspaceName}`);
  }
}
