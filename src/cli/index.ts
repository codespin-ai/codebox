#!/usr/bin/env node
// src/cli/index.ts

import yargs from "yargs";
import { start } from "./commands/start.js";
import { startHttpServer } from "../mcp/serverHttp.js";
import {
  addWorkspace,
  listWorkspaces,
  removeWorkspace,
} from "./commands/workspace.js";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setInvokeMode } from "../logging/logger.js";

setInvokeMode("cli");

// Function to get the version from package.json
export function getVersion() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const packagePath = path.resolve(__dirname, "../../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return `Codebox v${packageJson.version}`;
}

export async function main() {
  await yargs(process.argv.slice(2))
    .command(
      "start",
      "Start the MCP server for executing commands in containers",
      undefined,
      async () => {
        await start({ workingDir: process.cwd() });
      }
    )
    .command(
      "http",
      "Start the MCP server over HTTP",
      (y) =>
        y
          .option("host", {
            type: "string",
            describe: "Host to bind (default: 0.0.0.0)",
          })
          .option("port", {
            type: "number",
            describe: "Port to listen on (default: 4000)",
          }),
      async (argv) => {
        await startHttpServer({
          host: argv.host as string | undefined,
          port: argv.port as number | undefined,
        });
      }
    )
    .command("workspace", "Workspace management commands", (yargs) => {
      return yargs
        .command(
          "add [dirname]",
          "Add a workspace directory to the registry",
          (y) => {
            return y
              .positional("dirname", {
                describe:
                  "Path to the workspace directory (defaults to current directory)",
                type: "string",
                default: ".",
              })
              .option("image", {
                type: "string",
                describe: "Docker image to use for this workspace",
              })
              .option("container", {
                type: "string",
                describe:
                  "Container name to execute commands in (for running containers)",
              })
              .option("name", {
                type: "string",
                describe:
                  "Custom name for the workspace (defaults to directory name)",
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
                describe:
                  "Copy workspace files to a temporary directory before mounting",
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
                  throw new Error(
                    "Either --image or --container must be specified"
                  );
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
          "remove [target]",
          "Remove a workspace from the registry by name or path",
          (y) => {
            return y
              .positional("target", {
                describe:
                  "Name or path of the workspace to remove (defaults to current directory)",
                type: "string",
                default: ".",
              })
              .option("name", {
                type: "string",
                describe:
                  "Name of the workspace to remove (alternative to specifying in target)",
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
        .command("list", "List all registered workspaces", {}, async () => {
          await listWorkspaces();
        })
        .demandCommand(
          1,
          "You must specify a workspace command (add/remove/list)"
        );
    })
    .command("version", "Display the current version", {}, async () => {
      console.log(getVersion());
    })
    .demandCommand(1, "You need to specify a command")
    .showHelpOnFail(true)
    .help("help")
    .alias("h", "help").argv;
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
