// src/config/types.ts
export type WorkspaceConfig = {
  name: string;
  path: string;
  containerPath?: string;
  image?: string;
  containerName?: string;
  network?: string;
  copy?: boolean;
  idleTimeout?: number; // Timeout in ms before automatically closing idle workspace
  runTemplate?: string; // Custom template for docker run command
  execTemplate?: string; // Custom template for docker exec command
};

export type SystemConfig = {
  workspaces: WorkspaceConfig[];
  debug?: boolean;
};
