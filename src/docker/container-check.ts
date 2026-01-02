// Docker container and network checks
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Check if a Docker container exists and is running
 */
export async function checkContainerRunning(containerName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`docker ps -q -f "name=^${containerName}$"`);
    return !!stdout.trim();
  } catch {
    return false;
  }
}

/**
 * Check if a Docker network exists
 */
export async function checkNetworkExists(networkName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `docker network inspect ${networkName} --format "{{.Name}}"`
    );
    return !!stdout.trim();
  } catch {
    return false;
  }
}
