// Remove workspace command

import * as path from "path";
import { getConfig, saveConfig } from "../../../config/workspaceConfig.js";
import type { WorkspaceOptions, CommandContext } from "./types.js";
import { print } from "./utils.js";

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
