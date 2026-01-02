// Workspace command types

export type WorkspaceOptions = {
  dirname?: string | undefined;
  target?: string | undefined;
  image?: string | undefined;
  containerName?: string | undefined;
  name?: string | undefined;
  containerPath?: string | undefined;
  network?: string | undefined;
  copy?: boolean | undefined;
  idleTimeout?: number | undefined;
  runTemplate?: string | undefined;
  execTemplate?: string | undefined;
};

export type CommandContext = {
  workingDir: string;
};

// Default idle timeout: 10 minutes in milliseconds
export const DEFAULT_IDLE_TIMEOUT = 600000;
