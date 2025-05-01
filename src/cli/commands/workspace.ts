import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getConfig, saveConfig } from "../../config/workspaceConfig.js";
import { validateDirectory } from "../../fs/pathValidation.js";

const execAsync = promisify(exec);

interface WorkspaceOptions {
  dirname?: string;
  target?: string;
  image?: string;
  containerName?: string;
  name?: string;
  containerPath?: string;
  network?: string;
  copy?: boolean; // Added new option
  idleTimeout?: number; // Added new option
  runTemplate?: string; // Added new option
  execTemplate?: string; // Added new option
}

interface CommandContext {
  workingDir: string;
}

// Default idle timeout: 10 minutes in milliseconds
const DEFAULT_IDLE_TIMEOUT = 600000;

// Helper function to format timeout for display
function formatIdleTimeout(timeout: number | undefined): string {
  if (timeout === 0) {
    return "Disabled";
  }

  const timeoutValue = timeout || DEFAULT_IDLE_TIMEOUT;
  const minutes = Math.floor(timeoutValue / 60000);
  return `${timeoutValue} ms (${minutes} minute${minutes !== 1 ? "s" : ""})`;
}

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
    copy = false, // Default to false
    idleTimeout,
    runTemplate,
    execTemplate,
  } = options;

  if (!image && !containerName) {
    throw new Error(
      "Either Docker image (--image) or container name (--container) is required"
    );
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
      const { stdout } = await execAsync(
        `docker ps -q -f "name=^${containerName}$"`
      );
      if (!stdout.trim()) {
        console.warn(
          `Warning: Container '${containerName}' not found or not running. Commands will fail until container is available.`
        );
      }
    } catch (_error) {
      console.warn(
        `Warning: Could not verify container '${containerName}'. Make sure Docker is running.`
      );
    }
  }

  // Verify network exists if specified
  if (network) {
    try {
      const { stdout } = await execAsync(
        `docker network inspect ${network} --format "{{.Name}}"`
      );
      if (!stdout.trim()) {
        console.warn(
          `Warning: Network '${network}' not found. Commands may fail until network is available.`
        );
      }
    } catch (_error) {
      console.warn(
        `Warning: Could not verify network '${network}'. Make sure Docker is running.`
      );
    }
  }

  // Get existing config
  const config = getConfig();

  // Check if workspace already exists by name
  const existingIndex = config.workspaces.findIndex(
    (p) => p.name === workspaceName
  );

  if (existingIndex !== -1) {
    // Update existing workspace's configuration
    if (image) {
      config.workspaces[existingIndex].image = image;
    }
    if (containerName) {
      config.workspaces[existingIndex].containerName = containerName;
    }
    if (containerPath) {
      config.workspaces[existingIndex].containerPath = containerPath;
    }
    if (network) {
      config.workspaces[existingIndex].network = network;
    }
    // Update copy setting
    config.workspaces[existingIndex].copy = copy;
    // Update idle timeout if specified
    if (idleTimeout !== undefined) {
      config.workspaces[existingIndex].idleTimeout = idleTimeout;
    }
    // Update run template if specified
    if (runTemplate !== undefined) {
      config.workspaces[existingIndex].runTemplate = runTemplate;
    }
    // Update exec template if specified
    if (execTemplate !== undefined) {
      config.workspaces[existingIndex].execTemplate = execTemplate;
    }
    config.workspaces[existingIndex].path = workspacePath;
    saveConfig(config);
    console.log(`Updated workspace: ${workspaceName}`);
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
    console.log(`Added workspace: ${workspaceName}`);
  }
}

export async function removeWorkspace(
  options: WorkspaceOptions,
  context: CommandContext
): Promise<void> {
  const { target = ".", name } = options;
  const config = getConfig();
  let index = -1;

  // If name is explicitly provided via --name, look for it first
  if (name) {
    index = config.workspaces.findIndex((p) => p.name === name);
    if (index !== -1) {
      const removedName = config.workspaces[index].name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      console.log(`Removed workspace: ${removedName}`);
      return;
    }
    console.log(`Workspace with name '${name}' not found`);
    return;
  }

  // If target has a slash, treat it as a path; otherwise, treat it as a name
  if (target.includes("/") || target.includes("\\")) {
    // It's a path - resolve it and find the matching workspace
    const workspacePath = path.resolve(context.workingDir, target);
    index = config.workspaces.findIndex((p) => p.path === workspacePath);

    if (index !== -1) {
      const removedName = config.workspaces[index].name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      console.log(`Removed workspace: ${removedName}`);
      return;
    }
    console.log(`Workspace not found for path: ${workspacePath}`);
  } else {
    // It's a name - look for exact name match
    index = config.workspaces.findIndex((p) => p.name === target);

    if (index !== -1) {
      const removedName = config.workspaces[index].name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      console.log(`Removed workspace: ${removedName}`);
      return;
    }
    console.log(`Workspace with name '${target}' not found`);
  }
}

export async function listWorkspaces(): Promise<void> {
  const config = getConfig();

  if (config.workspaces.length === 0) {
    console.log(
      "No workspaces are registered. Use 'codebox workspace add <dirname> --image <image_name>' or 'codebox workspace add <dirname> --container <container_name>' to add workspaces."
    );
    return;
  }

  console.log("Registered workspaces:");
  console.log("-------------------");

  config.workspaces.forEach((workspace, index) => {
    const exists = fs.existsSync(workspace.path);

    console.log(`${index + 1}. ${workspace.name}`);
    console.log(`   Status: ${exists ? "exists" : "missing"}`);

    if (workspace.containerName) {
      console.log(`   Container: ${workspace.containerName}`);
    }

    if (workspace.image) {
      console.log(`   Docker Image: ${workspace.image}`);
    }

    if (workspace.containerPath) {
      console.log(`   Container Path: ${workspace.containerPath}`);
    }

    if (workspace.network) {
      console.log(`   Docker Network: ${workspace.network}`);
    }

    // Show copy setting if enabled
    if (workspace.copy) {
      console.log(`   Copy Files: Yes`);
    }

    // Show idle timeout
    console.log(`   Idle Timeout: ${formatIdleTimeout(workspace.idleTimeout)}`);

    // Show run template if specified
    if (workspace.runTemplate) {
      console.log(`   Run Template: ${workspace.runTemplate}`);
    }

    // Show exec template if specified
    if (workspace.execTemplate) {
      console.log(`   Exec Template: ${workspace.execTemplate}`);
    }

    console.log();
  });
}
