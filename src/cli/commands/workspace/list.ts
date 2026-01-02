// List workspaces command

import * as fs from "fs";
import { getConfig } from "../../../config/workspaceConfig.js";
import { print, formatIdleTimeout } from "./utils.js";

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
