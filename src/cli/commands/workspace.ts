import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getConfig, saveConfig } from "../../config/workspaceConfig.js";
import { validateDirectory } from "../../fs/pathValidation.js";

const execAsync = promisify(exec);

interface ProjectOptions {
  dirname?: string;
  target?: string;
  image?: string;
  containerName?: string;
  name?: string;
  containerPath?: string;
  network?: string;
  copy?: boolean; // Added new option
}

interface CommandContext {
  workingDir: string;
}

export async function addProject(
  options: ProjectOptions,
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
  } = options;

  if (!image && !containerName) {
    throw new Error(
      "Either Docker image (--image) or container name (--container) is required"
    );
  }

  // Resolve to absolute path
  const projectPath = path.resolve(context.workingDir, dirname);

  // Check if directory exists and is a directory
  validateDirectory(projectPath);

  // Extract project name from the path if not provided
  const projectName = name || path.basename(projectPath);

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

  // Check if project already exists by name
  const existingIndex = config.projects.findIndex(
    (p) => p.name === projectName
  );

  if (existingIndex !== -1) {
    // Update existing project's configuration
    if (image) {
      config.projects[existingIndex].dockerImage = image;
    }
    if (containerName) {
      config.projects[existingIndex].containerName = containerName;
    }
    if (containerPath) {
      config.projects[existingIndex].containerPath = containerPath;
    }
    if (network) {
      config.projects[existingIndex].network = network;
    }
    // Update copy setting
    config.projects[existingIndex].copy = copy;
    config.projects[existingIndex].hostPath = projectPath;
    saveConfig(config);
    console.log(`Updated project: ${projectName}`);
  } else {
    // Add new project
    config.projects.push({
      name: projectName,
      hostPath: projectPath,
      ...(containerPath && { containerPath }),
      ...(image && { dockerImage: image }),
      ...(containerName && { containerName }),
      ...(network && { network }),
      ...(copy && { copy: true }),
    });
    saveConfig(config);
    console.log(`Added project: ${projectName}`);
  }
}

export async function removeProject(
  options: ProjectOptions,
  context: CommandContext
): Promise<void> {
  const { target = ".", name } = options;
  const config = getConfig();
  let index = -1;

  // If name is explicitly provided via --name, look for it first
  if (name) {
    index = config.projects.findIndex((p) => p.name === name);
    if (index !== -1) {
      const removedName = config.projects[index].name;
      config.projects.splice(index, 1);
      saveConfig(config);
      console.log(`Removed project: ${removedName}`);
      return;
    }
    console.log(`Project with name '${name}' not found`);
    return;
  }

  // If target has a slash, treat it as a path; otherwise, treat it as a name
  if (target.includes("/") || target.includes("\\")) {
    // It's a path - resolve it and find the matching project
    const projectPath = path.resolve(context.workingDir, target);
    index = config.projects.findIndex((p) => p.hostPath === projectPath);

    if (index !== -1) {
      const removedName = config.projects[index].name;
      config.projects.splice(index, 1);
      saveConfig(config);
      console.log(`Removed project: ${removedName}`);
      return;
    }
    console.log(`Project not found for path: ${projectPath}`);
  } else {
    // It's a name - look for exact name match
    index = config.projects.findIndex((p) => p.name === target);

    if (index !== -1) {
      const removedName = config.projects[index].name;
      config.projects.splice(index, 1);
      saveConfig(config);
      console.log(`Removed project: ${removedName}`);
      return;
    }
    console.log(`Project with name '${target}' not found`);
  }
}

export async function listProjects(): Promise<void> {
  const config = getConfig();

  if (config.projects.length === 0) {
    console.log(
      "No projects are registered. Use 'codebox project add <dirname> --image <image_name>' or 'codebox project add <dirname> --container <container_name>' to add projects."
    );
    return;
  }

  console.log("Registered projects:");
  console.log("-------------------");

  config.projects.forEach((project, index) => {
    const exists = fs.existsSync(project.hostPath);

    console.log(`${index + 1}. ${project.name}`);
    console.log(`   Status: ${exists ? "exists" : "missing"}`);

    if (project.containerName) {
      console.log(`   Container: ${project.containerName}`);
    }

    if (project.dockerImage) {
      console.log(`   Docker Image: ${project.dockerImage}`);
    }

    if (project.containerPath) {
      console.log(`   Container Path: ${project.containerPath}`);
    }

    if (project.network) {
      console.log(`   Docker Network: ${project.network}`);
    }

    // Show copy setting if enabled
    if (project.copy) {
      console.log(`   Copy Files: Yes`);
    }

    console.log();
  });
}
