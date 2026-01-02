// Session management for HTTP transport
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../../../logging/console-logger.js";

// Session tracking
const transports = new Map<string, StreamableHTTPServerTransport>();
const sessionActivity = new Map<string, number>();

export function getTransport(sessionId: string): StreamableHTTPServerTransport | undefined {
  return transports.get(sessionId);
}

export function hasSession(sessionId: string): boolean {
  return transports.has(sessionId);
}

export function setTransport(sessionId: string, transport: StreamableHTTPServerTransport): void {
  transports.set(sessionId, transport);
}

export function deleteSession(sessionId: string): void {
  transports.delete(sessionId);
  sessionActivity.delete(sessionId);
}

export function updateSessionActivity(sessionId: string): void {
  sessionActivity.set(sessionId, Date.now());
}

export function startIdleSessionCleanup(idleTimeout: number): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActivity] of sessionActivity.entries()) {
      if (now - lastActivity > idleTimeout) {
        const transport = transports.get(sid);
        if (transport) {
          logger.info(
            `Closing idle session ${sid} after ${Math.round((now - lastActivity) / 1000 / 60)} minutes of inactivity`
          );
          transport.close();
        }
        sessionActivity.delete(sid);
      }
    }
  }, 60000); // Check every minute
}

export function closeAllSessions(): void {
  for (const [sessionId, transport] of transports) {
    try {
      transport.close();
    } catch (_err) {
      // Ignore errors during cleanup
    }
    transports.delete(sessionId);
    sessionActivity.delete(sessionId);
  }
}
