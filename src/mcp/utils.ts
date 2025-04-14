// src/mcp/utils.ts
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const uid = process.getuid?.();
const gid = process.getgid?.();

export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

export function getProjectsFile(): string {
  return path.join(os.homedir(), ".codespin", "codebox.json");
}

export function getProjects(): string[] {
  const projectsFile = getProjectsFile();

  if (!fs.existsSync(projectsFile)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    return data.projects || [];
  } catch (error) {
    console.error("Failed to parse projects file");
    return [];
  }
}

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
  const registeredProjects = getProjects().map((p) => p.replace(/\/+$/, ""));

  // Check if the normalized input path is a subdirectory of any registered project
  for (const registeredPath of registeredProjects) {
    // Check if the input path starts with a registered path followed by either
    // end of string or a path separator
    if (
      normalizedInputPath === registeredPath ||
      normalizedInputPath.startsWith(registeredPath + path.sep)
    ) {
      return true;
    }
  }

  return false;
}

export function validateFilePath(
  projectDir: string,
  filePath: string
): boolean {
  const resolvedProjectDir = path.resolve(projectDir);
  const fullPath = path.join(resolvedProjectDir, filePath);

  // Ensure the resulting path is still within the project directory
  return fullPath.startsWith(resolvedProjectDir);
}

export function getSystemConfig(): { dockerImage?: string } | null {
  const configFile = getProjectsFile();

  if (!fs.existsSync(configFile)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configFile, "utf8"));
  } catch (error) {
    console.error("Failed to parse system config file");
    return null;
  }
}

export function getDockerImage(projectDir: string): string | null {
  // First check project-level configuration
  const configFile = path.join(projectDir, ".codespin", "codebox.json");

  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
      if (config.dockerImage) {
        return config.dockerImage;
      }
    } catch (error) {
      console.error(`Failed to parse config file for ${projectDir}`);
    }
  }

  // Fallback to system-level configuration
  const systemConfig = getSystemConfig();
  return systemConfig?.dockerImage || null;
}

export async function executeInContainer(
  projectDir: string,
  command: string,
  dockerImage: string
): Promise<ExecuteResult> {
  const dockerCommand = `docker run -i --rm \
  -v "${projectDir}:/home/project" \
  --workdir="/home/project" \
  --user=${uid}:${gid} \
  ${dockerImage} /bin/sh -c "${command}"`;

  try {
    return await execAsync(dockerCommand, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
  } catch (error: any) {
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";
    const combinedOutput = `${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`;

    throw new Error(
      `Docker execution failed:\n${
        error.message ? error.message + "\n" : ""
      }${combinedOutput}`
    );
  }
}
