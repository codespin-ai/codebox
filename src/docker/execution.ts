// src/docker/execution.ts
import { exec } from "child_process";
import { promisify } from "util";
import { getProjectByName } from "../config/workspaceConfig.js";

const execAsync = promisify(exec);

/**
 * Result of executing a command in Docker
 */
export interface ExecuteResult {
  stdout: string;
  stderr: string;
}

/**
 * Get the UID/GID for Docker container execution
 */
export const uid = process.getuid?.();
export const gid = process.getgid?.();

/**
 * Execute a command in a Docker container based on project configuration
 * @param projectName Name of the project
 * @param command Command to execute
 * @param hostDir Working directory to mount (session working dir)
 */
export async function executeDockerCommand(
  projectName: string,
  command: string,
  hostDir: string
): Promise<ExecuteResult> {
  const project = getProjectByName(projectName);
  if (!project) {
    throw new Error(`Project not registered: ${projectName}`);
  }

  try {
    if (project.containerName) {
      // Execute in existing container
      return await executeInExistingContainer(
        project.containerName,
        command,
        project.containerPath
      );
    } else if (project.dockerImage) {
      // Execute in new container from image
      return await executeWithDockerImage(
        project.dockerImage,
        hostDir,
        command,
        project.containerPath,
        project.network
      );
    } else {
      throw new Error(
        "No Docker image or container configured for this project"
      );
    }
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout || "";
    const stderr = (error as { stderr?: string }).stderr || "";
    const combinedOutput = `${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`;

    throw new Error(
      `Docker execution failed:\n${
        (error as Error).message ? (error as Error).message + "\n" : ""
      }${combinedOutput}`
    );
  }
}

/**
 * Check if a Docker container exists and is running
 */
export async function checkContainerRunning(
  containerName: string
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker ps -q -f "name=^${containerName}$"`
    );
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Check if a Docker network exists
 */
export async function checkNetworkExists(
  networkName: string
): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker network inspect ${networkName} --format "{{.Name}}"`
    );
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Execute command inside an existing Docker container
 */
async function executeInExistingContainer(
  containerName: string,
  command: string,
  workdir = "/workspace"
): Promise<ExecuteResult> {
  // Check if container is running
  if (!(await checkContainerRunning(containerName))) {
    throw new Error(`Container '${containerName}' not found or not running`);
  }

  // Execute command in the running container with the user's UID/GID
  const dockerCommand = `docker exec -i --user=${uid}:${gid} --workdir="${workdir}" ${containerName} /bin/sh -c "${command}"`;

  return await execAsync(dockerCommand, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
}

/**
 * Execute command in a new Docker container from an image
 */
async function executeWithDockerImage(
  image: string,
  hostPath: string,
  command: string,
  containerPath = "/workspace",
  network?: string
): Promise<ExecuteResult> {
  // Add network parameter if specified
  const networkParam = network ? `--network="${network}"` : "";

  const dockerCommand = `docker run -i --rm \
    ${networkParam} \
    -v "${hostPath}:${containerPath}" \
    --workdir="${containerPath}" \
    --user=${uid}:${gid} \
    ${image} /bin/sh -c "${command}"`;

  return await execAsync(dockerCommand, {
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
  });
}
