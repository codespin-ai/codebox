// src/test/integration/testUtils.ts
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export const execAsync = promisify(exec);

/**
 * Check if Docker is available on the system
 */
export function isDockerAvailable(): Promise<boolean> {
  return execAsync("docker --version")
    .then(() => true)
    .catch(() => false);
}

/**
 * Create a test Docker container that stays running
 * @param name Container name
 * @param image Image to use
 * @param volume Host path to mount
 * @param containerPath Path inside container
 * @returns Promise resolving when container is started
 */
export async function createTestContainer(
  name: string,
  image = "alpine:latest",
  volume?: string,
  containerPath = "/workspace"
): Promise<void> {
  // Pull the image first
  await execAsync(`docker pull ${image}`);

  // Build the docker run command
  let cmd = `docker run -d --name ${name}`;

  // Add volume if specified
  if (volume) {
    cmd += ` -v "${volume}:${containerPath}"`;
  }

  // Keep container running
  cmd += ` ${image} sh -c "trap : TERM INT; sleep infinity & wait"`;

  await execAsync(cmd);

  // Verify container is running
  const { stdout } = await execAsync(`docker ps -q -f "name=${name}"`);
  if (!stdout.trim()) {
    throw new Error(`Container ${name} failed to start`);
  }
}

/**
 * Remove a Docker container
 */
export async function removeContainer(name: string): Promise<void> {
  try {
    await execAsync(`docker rm -f ${name}`);
  } catch (error) {
    console.error(`Failed to remove container ${name}: ${error}`);
  }
}

/**
 * Create a Docker network
 */
export async function createNetwork(name: string): Promise<void> {
  try {
    await execAsync(`docker network create ${name}`);
  } catch (error) {
    console.error(`Failed to create network ${name}: ${error}`);
  }
}

/**
 * Remove a Docker network
 */
export async function removeNetwork(name: string): Promise<void> {
  try {
    await execAsync(`docker network rm ${name}`);
  } catch (error) {
    console.error(`Failed to remove network ${name}: ${error}`);
  }
}

/**
 * Create a file with the given content
 */
export function createTestFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Check if a file exists with the expected content
 */
export function verifyFileContent(filePath: string, expectedContent: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const content = fs.readFileSync(filePath, "utf8");
  return content === expectedContent;
}

/**
 * Generate a unique name for tests
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
