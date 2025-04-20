// src/config/projectConfig.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { WorkspaceConfig, SystemConfig } from "./types.js";

// Configurable base path for testing
let configBasePath = os.homedir();

/**
 * Set a custom base path for configuration
 * Used primarily for testing
 */
export function setConfigBasePath(path: string): void {
  configBasePath = path;
}

/**
 * Get the current base path for configuration
 */
export function getConfigBasePath(): string {
  return configBasePath;
}

/**
 * Get the path to the config file
 */
export function getConfigFilePath(): string {
  const configDir = path.join(configBasePath, ".codespin");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, "codebox.json");
}

/**
 * Read the configuration from the config file
 */
export function getConfig(): SystemConfig {
  const configFile = getConfigFilePath();

  if (!fs.existsSync(configFile)) {
    return { workspaces: [] };
  }

  try {
    const data = JSON.parse(fs.readFileSync(configFile, "utf8"));
    return {
      workspaces: Array.isArray(data.projects) ? data.projects : [],
      debug: data.debug,
    };
  } catch {
    console.error("Failed to parse config file, creating new one");
    return { workspaces: [] };
  }
}

/**
 * Write the configuration to the config file
 */
export function saveConfig(config: SystemConfig): void {
  const configFile = getConfigFilePath();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Get all registered projects
 */
export function getWorkspaces(): WorkspaceConfig[] {
  const config = getConfig();
  return config.workspaces;
}

/**
 * Find a workspace by name
 */
export function getWorkspaceByName(workspaceName: string): WorkspaceConfig | null {
  const workspaces = getWorkspaces();
  return workspaces.find((p) => p.name === workspaceName) || null;
}

/**
 * Validate that a workspace exists with the given name
 */
export function validateWorkspaceName(workspaceName: string): boolean {
  const workspace = getWorkspaceByName(workspaceName);
  return (
    workspace !== null &&
    fs.existsSync(workspace.hostPath) &&
    fs.statSync(workspace.hostPath).isDirectory()
  );
}

/**
 * Find a workspace that contains the given directory
 */
export function getWorkspaceForDirectory(
  projectDir: string
): WorkspaceConfig | null {
  const resolvedPath = path.resolve(projectDir);
  const workspaces = getWorkspaces();

  // Find the workspace configuration
  const workspace = workspaces.find((p) => {
    const normalizedProjectPath = p.hostPath.replace(/\/+$/, "");
    const normalizedInputPath = resolvedPath.replace(/\/+$/, "");

    return (
      normalizedInputPath === normalizedProjectPath ||
      normalizedInputPath.startsWith(normalizedProjectPath + path.sep)
    );
  });

  return workspace || null;
}

/**
 * Check if the directory is a registered workspace
 */
export function validateProject(projectDir: string): boolean {
  const resolvedPath = path.resolve(projectDir);

  // Ensure path exists and is a directory
  if (
    !fs.existsSync(resolvedPath) ||
    !fs.statSync(resolvedPath).isDirectory()
  ) {
    return false;
  }

  // Normalize paths by removing trailing slashes for consistent comparison
  const normalizedInputPath = resolvedPath.replace(/\/+$/, "");
  const registeredWorkspaces = getWorkspaces();

  // Check if the normalized input path is a registered workspace
  for (const workspace of registeredWorkspaces) {
    const normalizedProjectPath = workspace.hostPath.replace(/\/+$/, "");

    // Check if the input path starts with a registered path followed by either
    // end of string or a path separator
    if (
      normalizedInputPath === normalizedProjectPath ||
      normalizedInputPath.startsWith(normalizedProjectPath + path.sep)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if debug mode is enabled in the config
 */
export function isDebugEnabled(): boolean {
  const config = getConfig();
  return !!config.debug;
}
