// Credential generation and environment handling
import * as fs from "fs";
import * as path from "path";
import { generateClientCredentials } from "./pkce.js";

// Get project root from environment or use current working directory
function getProjectRoot(): string {
  return process.cwd();
}

function getEnvPath(): string {
  return path.join(getProjectRoot(), ".env");
}

// Parse .env file content
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex);
        const value = trimmed.substring(eqIndex + 1);
        result[key] = value;
      }
    }
  }
  return result;
}

// Load .env file manually (no dependencies)
export function loadEnvFile(): void {
  const envPath = getEnvPath();
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const parsed = parseEnvContent(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env doesn't exist, that's fine
  }
}

// Create .env file with random credentials
export function createEnvFile(): { clientId: string; clientSecret: string } {
  const envPath = getEnvPath();
  const credentials = generateClientCredentials();
  const envContent = `# OAuth Client Credentials (required for HTTP mode)
CLIENT_ID=${credentials.clientId}
CLIENT_SECRET=${credentials.clientSecret}

# Server configuration (optional)
PORT=13014
`;
  fs.writeFileSync(envPath, envContent);
  return credentials;
}

// Check if .env file exists
export function envFileExists(): boolean {
  return fs.existsSync(getEnvPath());
}

// Get client credentials from environment
export function getClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}
