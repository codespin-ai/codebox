#!/usr/bin/env node

import yargs from "yargs";
import { start } from "./commands/start.js";
import { addProject, listProjects, removeProject } from "./commands/project.js";
import { setInvokeMode } from "./utils/invokeMode.js";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

setInvokeMode("cli");

// Function to get the version from package.json
export function getVersion() {
  // Get the directory name of the current module
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // Read package.json from the root directory
  const packagePath = path.resolve(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  return `Codebox v${packageJson.version}`;
}

export async function main() {
  await yargs(process.argv.slice(2))
    .command(
      "start",
      "Start the MCP server for executing commands in containers",
      (yargs) => yargs,
      async () => {
        await start({ workingDir: process.cwd() });
      }
    )
    .command(
      "project",
      "Project management commands",
      (yargs) => {
        return yargs
          .command(
            "add [dirname]",
            "Add a project directory to the registry",
            (yargs) => {
              return yargs
                .positional("dirname", {
                  describe:
                    "Path to the project directory (defaults to current directory)",
                  type: "string",
                  default: ".",
                })
                .option("image", {
                  type: "string",
                  describe: "Docker image to use for this project",
                })
                .option("container", {
                  type: "string",
                  describe:
                    "Container name to execute commands in (for running containers)",
                })
                .option("name", {
                  type: "string",
                  describe:
                    "Custom name for the project (defaults to directory name)",
                })
                .option("containerPath", {
                  type: "string",
                  describe:
                    "Path inside the container to mount the project (defaults to /workspace)",
                })
                .option("network", {
                  type: "string",
                  describe:
                    "Docker network to connect the container to (for Docker Compose environments)",
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
              await addProject(
                {
                  dirname: argv.dirname,
                  image: argv.image,
                  containerName: argv.container,
                  name: argv.name,
                  containerPath: argv.containerPath,
                  network: argv.network,
                },
                { workingDir: process.cwd() }
              );
            }
          )
          .command(
            "remove [target]",
            "Remove a project from the registry by name or path",
            (yargs) => {
              return yargs
                .positional("target", {
                  describe:
                    "Name or path of the project to remove (defaults to current directory)",
                  type: "string",
                  default: ".",
                })
                .option("name", {
                  type: "string",
                  describe:
                    "Name of the project to remove (alternative to specifying in target)",
                });
            },
            async (argv) => {
              await removeProject(
                {
                  target: argv.target,
                  name: argv.name,
                },
                { workingDir: process.cwd() }
              );
            }
          )
          .demandCommand(1, "You must specify a project command (add/remove)")
          .command("list", "List all registered projects", {}, async () => {
            await listProjects();
          })
          .demandCommand(
            1,
            "You must specify a project command (add/remove/list)"
          );
      },
      () => {
        /* empty function required by yargs */
      }
    )
    .command("version", "Display the current version", {}, async () => {
      writeToConsole(getVersion());
    })
    .demandCommand(1, "You need to specify a command")
    .showHelpOnFail(true)
    .help("help")
    .alias("h", "help").argv;
}

function writeToConsole(text?: string) {
  console.log(text ?? "");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
