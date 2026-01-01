import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getConfig, saveConfig } from "../../config/workspaceConfig.js";
import { validateDirectory } from "../../fs/pathValidation.js";

// CLI output helpers - write directly to stdout/stderr for user-facing output
function print(message: string): void {
  process.stdout.write(message + "\n");
}

function printWarning(message: string): void {
  process.stderr.write("Warning: " + message + "\n");
}

const execAsync = promisify(exec);

type WorkspaceOptions = {
  dirname?: string | undefined;
  target?: string | undefined;
  image?: string | undefined;
  containerName?: string | undefined;
  name?: string | undefined;
  containerPath?: string | undefined;
  network?: string | undefined;
  copy?: boolean | undefined;
  idleTimeout?: number | undefined;
  runTemplate?: string | undefined;
  execTemplate?: string | undefined;
};

type CommandContext = {
  workingDir: string;
};

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
    const workspace = config.workspaces[index];
    if (index !== -1 && workspace) {
      const removedName = workspace.name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      print(`Removed workspace: ${removedName}`);
      return;
    }
    print(`Workspace with name '${name}' not found`);
    return;
  }

  // If target has a slash, treat it as a path; otherwise, treat it as a name
  if (target.includes("/") || target.includes("\\")) {
    // It's a path - resolve it and find the matching workspace
    const workspacePath = path.resolve(context.workingDir, target);
    index = config.workspaces.findIndex((p) => p.path === workspacePath);
    const workspace = config.workspaces[index];

    if (index !== -1 && workspace) {
      const removedName = workspace.name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      print(`Removed workspace: ${removedName}`);
      return;
    }
    print(`Workspace not found for path: ${workspacePath}`);
  } else {
    // It's a name - look for exact name match
    index = config.workspaces.findIndex((p) => p.name === target);
    const workspace = config.workspaces[index];

    if (index !== -1 && workspace) {
      const removedName = workspace.name;
      config.workspaces.splice(index, 1);
      saveConfig(config);
      print(`Removed workspace: ${removedName}`);
      return;
    }
    print(`Workspace with name '${target}' not found`);
  }
}

export async function listWorkspaces(): Promise<void> {
  const config = getConfig();

  if (config.workspaces.length === 0) {
    print(
      "No workspaces are registered. Use 'codebox workspace add <dirname> --image <image_name>' or 'codebox workspace add <dirname> --container <container_name>' to add workspaces."
    );
    return;
  }

  print("Registered workspaces:");
  print("-------------------");

  config.workspaces.forEach((workspace, index) => {
    const exists = fs.existsSync(workspace.path);

    print(`${index + 1}. ${workspace.name}`);
    print(`   Dir: ${workspace.path}`);

    print(`   Status: ${exists ? "exists" : "missing"}`);

    if (workspace.containerName) {
      print(`   Container: ${workspace.containerName}`);
    }

    if (workspace.image) {
      print(`   Docker Image: ${workspace.image}`);
    }

    if (workspace.containerPath) {
      print(`   Container Path: ${workspace.containerPath}`);
    }

    if (workspace.network) {
      print(`   Docker Network: ${workspace.network}`);
    }

    // Show copy setting if enabled
    if (workspace.copy) {
      print(`   Copy Files: Yes`);
    }

    // Show idle timeout
    print(`   Idle Timeout: ${formatIdleTimeout(workspace.idleTimeout)}`);

    // Show run template if specified
    if (workspace.runTemplate) {
      print(`   Run Template: ${workspace.runTemplate}`);
    }

    // Show exec template if specified
    if (workspace.execTemplate) {
      print(`   Exec Template: ${workspace.execTemplate}`);
    }

    print("");
  });
}
