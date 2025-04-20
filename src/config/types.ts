// src/config/types.ts
export interface WorkspaceConfig {
  name: string;
  hostPath: string;
  containerPath?: string;
  dockerImage?: string;
  containerName?: string;
  network?: string;
  copy?: boolean;
}

export interface SystemConfig {
  workspaces: WorkspaceConfig[];
  debug?: boolean;
}
