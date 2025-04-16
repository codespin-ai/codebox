import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { SystemConfig } from "../types/config.js";

const execAsync = promisify(exec);

interface ProjectOptions {
  dirname: string;
  image?: string;
  containerName?: string;
}

interface CommandContext {
  workingDir: string;
}

function getConfigFile(): string {
  const configDir = path.join(os.homedir(), ".codespin");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  return path.join(configDir, "codebox.json");
}

function getConfig(): SystemConfig {
  const configFile = getConfigFile();

  if (!fs.existsSync(configFile)) {
    return { projects: [] };
  }

  try {
    const data = JSON.parse(fs.readFileSync(configFile, "utf8"));
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
      debug: data.debug,
    };
  } catch {
    console.error("Failed to parse config file, creating new one");
    return { projects: [] };
  }
}

function saveConfig(config: SystemConfig): void {
  const configFile = getConfigFile();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), "utf8");
}

export async function addProject(
  options: ProjectOptions,
  context: CommandContext
): Promise<void> {
  const { dirname, image, containerName } = options;

  if (!image && !containerName) {
    throw new Error(
      "Either Docker image (--image) or container name (--container) is required"
    );
  }

  // Resolve to absolute path
  const projectPath = path.resolve(context.workingDir, dirname);

  // Check if directory exists
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Directory not found: ${projectPath}`);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${projectPath}`);
  }

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

  // Get existing config
  const config = getConfig();

  // Check if project already exists
  const existingIndex = config.projects.findIndex(
    (p) => p.path === projectPath
  );

  if (existingIndex !== -1) {
    // Update existing project's configuration
    if (image) {
      config.projects[existingIndex].dockerImage = image;
    }
    if (containerName) {
      config.projects[existingIndex].containerName = containerName;
    }
    saveConfig(config);
    console.log(`Updated project: ${projectPath}`);
  } else {
    // Add new project
    config.projects.push({
      path: projectPath,
      ...(image && { dockerImage: image }),
      ...(containerName && { containerName }),
    });
    saveConfig(config);
    console.log(`Added project: ${projectPath}`);
  }
}

export async function removeProject(
  options: ProjectOptions,
  _context: CommandContext
): Promise<void> {
  const { dirname } = options;

  // Resolve to absolute path
  const projectPath = path.resolve(_context.workingDir, dirname);

  // Get existing config
  const config = getConfig();

  // Find project index
  const index = config.projects.findIndex((p) => p.path === projectPath);

  if (index !== -1) {
    // Remove project
    config.projects.splice(index, 1);
    saveConfig(config);
    console.log(`Removed project: ${projectPath}`);
  } else {
    console.log(`Project not found in list: ${projectPath}`);
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
    const exists = fs.existsSync(project.path);

    console.log(`${index + 1}. ${project.path}`);
    console.log(`   Status: ${exists ? "exists" : "missing"}`);

    if (project.containerName) {
      console.log(`   Container: ${project.containerName}`);
    }

    if (project.dockerImage) {
      console.log(`   Docker Image: ${project.dockerImage}`);
    }

    console.log();
  });
}
