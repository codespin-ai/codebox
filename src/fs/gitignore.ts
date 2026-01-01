// Gitignore filtering utilities using the 'ignore' package
import * as fs from "fs";
import * as path from "path";
import ignore from "ignore";
import type { Ignore } from "ignore";

// Create an ignore filter from a directory's .gitignore file
export function createGitignoreFilter(workingDir: string): Ignore | null {
  const gitignorePath = path.join(workingDir, ".gitignore");

  try {
    if (!fs.existsSync(gitignorePath)) {
      return null;
    }

    const content = fs.readFileSync(gitignorePath, "utf-8");
    const ig = ignore();
    ig.add(content);
    return ig;
  } catch {
    return null;
  }
}

// Check if a path should be ignored based on gitignore rules
export function shouldIgnore(
  relativePath: string,
  ig: Ignore | null,
  respectGitignore: boolean
): boolean {
  if (!respectGitignore || !ig) {
    return false;
  }
  return ig.ignores(relativePath);
}

// Filter an array of paths based on gitignore rules
export function filterByGitignore(
  paths: string[],
  workingDir: string,
  respectGitignore: boolean
): string[] {
  if (!respectGitignore) {
    return paths;
  }

  const ig = createGitignoreFilter(workingDir);
  if (!ig) {
    return paths;
  }

  return paths.filter((p) => {
    const relativePath = path.relative(workingDir, p);
    return !ig.ignores(relativePath);
  });
}
