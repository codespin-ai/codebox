// Workspace token types

// Default idle timeout (10 minutes in milliseconds)
export const DEFAULT_IDLE_TIMEOUT = 600000;

// Workspace token information including working directory
export type WorkspaceTokenInfo = {
  workspaceName: string;
  workingDir: string; // Either original path or temp directory
  isTempDir: boolean; // Flag to determine if cleanup is needed when closing
  lastAccessTime: number; // Timestamp of last access
  idleTimeout: number; // Timeout in ms before auto-closing (0 means disabled)
};
