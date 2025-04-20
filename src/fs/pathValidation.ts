import * as path from "path";
import * as fs from "fs";

/**
 * Validate that a directory exists
 * @throws Error if directory doesn't exist or is not a directory
 */
export function validateDirectory(dirPath: string): void {
  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  // Check if it's a directory
  if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Path is not a directory: ${dirPath}`);
  }
}

/**
 * Validate that a file path is within a workspace directory
 */
export function validateFilePath(
  workspaceDir: string,
  filePath: string
): boolean {
  // Get absolute path of workspace directory
  const resolvedWorkspaceDir = path.resolve(workspaceDir);

  try {
    // Immediately reject absolute paths
    if (path.isAbsolute(filePath)) {
      return false;
    }

    // Resolve the normalized absolute path of the combined path
    // This properly handles ../ paths
    const fullPath = path.resolve(resolvedWorkspaceDir, filePath);

    // Check if the normalized path starts with the workspace directory
    return (
      fullPath === resolvedWorkspaceDir ||
      fullPath.startsWith(resolvedWorkspaceDir + path.sep)
    );
  } catch {
    // Any path resolution errors are treated as security issues
    return false;
  }
}

/**
 * Ensure directories exist for a file path
 */
export function ensureDirectoryForFile(filePath: string): void {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
