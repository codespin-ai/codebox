// Idle workspace cleanup

import { logger } from "../logging/console-logger.js";
import { getActiveWorkspaceTokens } from "./store.js";
import { closeWorkspace } from "./close.js";

// Timer reference for the cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the idle workspace cleanup process
 * @param checkInterval How often to check for idle workspaces (in ms)
 */
export function startIdleWorkspaceCleanup(checkInterval = 60000): void {
  // Clear any existing interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }

  // Set up new interval
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    checkAndCloseIdleWorkspaces(now);
  }, checkInterval);

  // Ensure the interval doesn't keep the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Check for and close idle workspaces
 * @param currentTime The current time to use for comparison (defaults to Date.now())
 * @returns Array of closed workspace token IDs
 */
export function checkAndCloseIdleWorkspaces(currentTime = Date.now()): string[] {
  const tokensToClose: string[] = [];
  const activeWorkspaceTokens = getActiveWorkspaceTokens();

  // Check each workspace token
  for (const [token, info] of Object.entries(activeWorkspaceTokens)) {
    // Skip workspaces that have disabled auto-close (idleTimeout = 0)
    if (info.idleTimeout === 0) continue;

    const idleTime = currentTime - info.lastAccessTime;
    if (idleTime >= info.idleTimeout) {
      tokensToClose.push(token);
    }
  }

  // Close idle workspaces
  for (const token of tokensToClose) {
    try {
      logger.info(`Auto-closing idle workspace token: ${token}`);
      closeWorkspace(token);
    } catch (error) {
      logger.error(`Error closing workspace token ${token}`, error);
    }
  }

  return tokensToClose;
}

/**
 * Stop the idle workspace cleanup process
 */
export function stopIdleWorkspaceCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
