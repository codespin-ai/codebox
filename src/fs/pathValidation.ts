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
 * Validate that a file path is within a project directory
 */
export function validateFilePath(
  projectDir: string,
  filePath: string
): boolean {
  // Get absolute path of project directory
  const resolvedProjectDir = path.resolve(projectDir);

  try {
    // Immediately reject absolute paths
    if (path.isAbsolute(filePath)) {
      return false;
    }

    // Resolve the normalized absolute path of the combined path
    // This properly handles ../ paths
    const fullPath = path.resolve(resolvedProjectDir, filePath);

    // Check if the normalized path starts with the project directory
    return (
      fullPath === resolvedProjectDir ||
      fullPath.startsWith(resolvedProjectDir + path.sep)
    );
  } catch (error) {
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
