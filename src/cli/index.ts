#!/usr/bin/env node
// src/cli/index.ts

import yargs from "yargs";
import { start } from "./commands/start.js";
import { startHttpTransport } from "../mcp/transports/http/index.js";
import { addWorkspace, listWorkspaces, removeWorkspace } from "./commands/workspace/index.js";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setInvokeMode } from "../logging/logger.js";
import { logger } from "../logging/console-logger.js";
import { createEnvFile, envFileExists } from "../auth/credentials.js";

setInvokeMode("cli");

// CLI output helper
function print(message: string): void {
  process.stdout.write(message + "\n");
}

// Function to get the version from package.json
export function getVersion() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.resolve(__dirname, "../../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version: string };
  return packageJson.version;
}

export async function main() {
  await yargs(process.argv.slice(2))
    .version(getVersion())
    .command(
      "start",
      "Start the MCP server",
      (y) =>
        y
          .option("http", {
            type: "boolean",
            describe: "Use HTTP streaming transport instead of stdio",
            default: false,
          })
          .option("no-auth", {
            type: "boolean",
            describe: "Disable OAuth authentication (HTTP mode only)",
            default: false,
          })
          .option("host", {
            type: "string",
            describe: "Host to bind (HTTP mode, default: 127.0.0.1)",
          })
          .option("port", {
            type: "number",
            describe: "Port to listen on (HTTP mode, default: 13014)",
          })
          .option("allowed-origins", {
            type: "array",
            describe: "Allowed origins for CORS (HTTP mode)",
          }),
      async (argv) => {
        if (argv.http) {
          await startHttpTransport({
            host: argv.host as string | undefined,
            port: argv.port as number | undefined,
            allowedOrigins: argv["allowed-origins"] as string[] | undefined,
            auth: !argv["no-auth"],
          });
        } else {
          await start({ workingDir: process.cwd() });
        }
      }
    )
    .command(
      "init",
      "Initialize OAuth credentials (.env file)",
      (y) =>
        y.option("force", {
          type: "boolean",
          describe: "Overwrite existing .env file",
          default: false,
        }),
      async (argv) => {
        if (envFileExists() && !argv.force) {
          print(".env file already exists. Use --force to overwrite.");
          process.exit(1);
        }
        const credentials = createEnvFile();
        print("Created .env file with OAuth credentials:");
        print(`  CLIENT_ID=${credentials.clientId}`);
        print(`  CLIENT_SECRET=${credentials.clientSecret}`);
        print("");
        print("You can now start the HTTP server with:");
        print("  codebox start --http");
      }
    )
    .command(["workspace", "ws"], "Workspace management commands", (yargs) => {
      return yargs
        .command(
          "add [dirname]",
          "Add a workspace directory to the registry",
          (y) => {
            return y
              .positional("dirname", {
                describe: "Path to the workspace directory (defaults to current directory)",
                type: "string",
                default: ".",
              })
              .option("image", {
                type: "string",
                describe: "Docker image to use for this workspace",
              })
              .option("container", {
                type: "string",
                describe: "Container name to execute commands in (for running containers)",
              })
              .option("name", {
                type: "string",
                describe: "Custom name for the workspace (defaults to directory name)",
              })
              .option("containerPath", {
                type: "string",
                describe:
                  "Path inside the container to mount the workspace (defaults to /workspace)",
              })
              .option("network", {
                type: "string",
                describe:
                  "Docker network to connect the container to (for Docker Compose environments)",
              })
              .option("copy", {
                type: "boolean",
                describe: "Copy workspace files to a temporary directory before mounting",
                default: false,
              })
              .option("idle-timeout", {
                type: "number",
                describe:
                  "Timeout in milliseconds before automatically closing idle workspace (0 to disable)",
              })
              .option("run-template", {
                type: "string",
                describe:
                  "Custom template for docker run command with variables like {{image}}, {{path}}, {{containerPath}}, {{command}}, {{network}}, {{uid}}, {{gid}}",
              })
              .option("exec-template", {
                type: "string",
                describe:
                  "Custom template for docker exec command with variables like {{containerName}}, {{containerPath}}, {{command}}, {{uid}}, {{gid}}",
              })
              .check((argv) => {
                if (!argv.image && !argv.container) {
                  throw new Error("Either --image or --container must be specified");
                }
                return true;
              });
          },
          async (argv) => {
            await addWorkspace(
              {
                dirname: argv.dirname,
                image: argv.image,
                containerName: argv.container,
                name: argv.name,
                containerPath: argv.containerPath,
                network: argv.network,
                copy: argv.copy,
                idleTimeout: argv["idle-timeout"],
                runTemplate: argv["run-template"],
                execTemplate: argv["exec-template"],
              },
              { workingDir: process.cwd() }
            );
          }
        )
        .command(
          ["remove [target]", "rm [target]"],
          "Remove a workspace from the registry by name or path",
          (y) => {
            return y
              .positional("target", {
                describe: "Name or path of the workspace to remove (defaults to current directory)",
                type: "string",
                default: ".",
              })
              .option("name", {
                type: "string",
                describe: "Name of the workspace to remove (alternative to specifying in target)",
              });
          },
          async (argv) => {
            await removeWorkspace(
              {
                target: argv.target,
                name: argv.name,
              },
              { workingDir: process.cwd() }
            );
          }
        )
        .command(["list", "ls"], "List all registered workspaces", {}, async () => {
          await listWorkspaces();
        })
        .demandCommand(1, "You must specify a workspace command (add/remove/list)");
    })
    .scriptName("codebox")
    .epilogue(`Run 'codebox --version' to see the current version`)
    .demandCommand(1, "You need to specify a command")
    .showHelpOnFail(true)
    .help("help")
    .alias("h", "help").argv;
}

main().catch((error: Error) => {
  logger.error("CLI error", error);
  process.exit(1);
});
