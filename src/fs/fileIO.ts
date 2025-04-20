// src/fs/fileIO.ts
import * as fs from "fs";
import * as path from "path";
import { validateFilePath, ensureDirectoryForFile } from "./pathValidation.js";

/**
 * Write content to a file in a project directory
 * @throws Error if the file path is outside the project directory
 */
export function writeProjectFile(
  workspaceDir: string,
  filePath: string,
  content: string,
  mode: "overwrite" | "append" = "overwrite"
): void {
  // Validate the file path - strict validation for security
  if (!validateFilePath(workspaceDir, filePath)) {
    throw new Error(
      `Invalid file path: ${filePath} - path traversal attempt detected`
    );
  }

  // Get the full path
  const fullPath = path.join(workspaceDir, filePath);

  // Make sure the directory exists
  ensureDirectoryForFile(fullPath);

  // Write the file
  fs.writeFileSync(fullPath, content, {
    flag: mode === "append" ? "a" : "w",
    encoding: "utf8",
  });
}

/**
 * Read content from a file in a project directory
 * @throws Error if the file path is outside the project directory
 */
export function readProjectFile(workspaceDir: string, filePath: string): string {
  // Validate the file path - strict validation for security
  if (!validateFilePath(workspaceDir, filePath)) {
    throw new Error(
      `Invalid file path: ${filePath} - path traversal attempt detected`
    );
  }

  // Get the full path
  const fullPath = path.join(workspaceDir, filePath);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read the file
  return fs.readFileSync(fullPath, "utf8");
}

/**
 * Check if a file exists in a project directory
 */
export function projectFileExists(
  workspaceDir: string,
  filePath: string
): boolean {
  // Validate the file path - strict validation for security
  if (!validateFilePath(workspaceDir, filePath)) {
    return false; // Don't throw, just return false for non-existent checks
  }

  // Get the full path
  const fullPath = path.join(workspaceDir, filePath);

  // Check if file exists
  return fs.existsSync(fullPath);
}
