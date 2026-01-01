// src/cli/commands/start.ts
import { startServer } from "../../mcp/server.js";

type CommandContext = {
  workingDir: string;
};

export async function start(_context: CommandContext): Promise<void> {
  await startServer();
}
