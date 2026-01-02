// Workspace command utilities

import { DEFAULT_IDLE_TIMEOUT } from "./types.js";

// CLI output helpers - write directly to stdout/stderr for user-facing output
export function print(message: string): void {
  process.stdout.write(message + "\n");
}

export function printWarning(message: string): void {
  process.stderr.write("Warning: " + message + "\n");
}

// Helper function to format timeout for display
export function formatIdleTimeout(timeout: number | undefined): string {
  if (timeout === 0) {
    return "Disabled";
  }

  const timeoutValue = timeout || DEFAULT_IDLE_TIMEOUT;
  const minutes = Math.floor(timeoutValue / 60000);
  return `${timeoutValue} ms (${minutes} minute${minutes !== 1 ? "s" : ""})`;
}
