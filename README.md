# Codebox

Codebox is an MCP Server for running commands within Docker containers for **specific workspaces**. It simplifies the process of executing code and commands in isolated, reproducible environments.

## Installation

```bash
npm install -g @codespin/codebox
```

## Usage

### Configure your MCP Client (such as LibreChat, Claude Desktop)

This is how you start the tool. Configure your MCP Client accordingly.

```bash
codebox start
```

For LibreChat, it will be:

```yaml
mcpServers:
  codebox:
    type: stdio
    command: codebox
    args:
      - start
    timeout: 30000 # 30‑second timeout for commands
    initTimeout: 10000 # 10‑second timeout for initialization
```

### Managing Workspaces

#### Adding a Workspace

Register a workspace directory with Codebox:

```bash
# Register current directory as a workspace with a Docker image
codebox workspace add --image node:18

# Register a specific directory as a workspace
codebox workspace add /path/to/workspace --image python:3.9

# Register with a custom name
codebox workspace add /path/to/workspace --image node:18 --name my-node-app

# Specify a custom path inside the container (default is /workspace)
codebox workspace add --image node:18 --containerPath /my-project

# Connect to a specific Docker network (for Docker Compose environments)
codebox workspace add --image node:18 --network my_compose_network

# Use a running container instead of a new container
codebox workspace add --container my-running-container

# Enable copy mode to isolate file changes from your source directory
# (Only works with --image, not with --container)
codebox workspace add --image node:18 --copy
```

#### Listing Workspaces

View all registered workspaces:

```bash
codebox workspace list
```

#### Removing a Workspace

Remove a workspace from the registry:

```bash
# Remove by name
codebox workspace remove my-workspace-name

# Remove by path
codebox workspace remove /path/to/workspace

# Remove current directory
codebox workspace remove
```

### Using with AI Assistants

Codebox implements the **Model Context Protocol (MCP)**. AI assistants can:

1. **List workspaces** using the `list_workspaces` tool.
2. **Open a workspace** via `open_workspace`. This returns a _workspace token_ that represents an isolated session (and, if `copy` was enabled for that workspace, a temporary copy of the files).
3. **Execute commands** inside the corresponding container with `execute_command` or `execute_batch_commands`, passing the workspace token.
4. **Read or write files** with `write_file` or `write_batch_files`, again using the workspace token.
5. **Close the workspace** with `close_workspace` when the assistant is done. This immediately cleans up any temporary directories created by copy mode.

Workspace tokens let multiple, concurrent sessions share the same underlying workspace definition while keeping their file‑system changes isolated.

## Workspace Configuration

Workspaces are stored in `~/.codespin/codebox.json` with the following structure:

```json
{
  "workspaces": [
    {
      "name": "my-node-app",
      "path": "/home/user/workspaces/my-node-app",
      "containerPath": "/my-project",
      "image": "node:18",
      "network": "my_compose_network",
      "copy": true
    },
    {
      "name": "python-api",
      "path": "/home/user/workspaces/python-api",
      "containerName": "running-python-container"
    }
  ],
  "debug": false
}
```

Each workspace has:

- `name`: Identifier for the workspace
- `path`: Workspace path on the host machine
- `containerPath`: (Optional) Path in the container where the workspace is mounted (defaults to `/workspace`)
- `image`: Docker image to use for new containers
- `containerName`: Name of an existing running container
- `network`: (Optional) Docker network to connect the container to
- `copy`: (Optional) When **true**, files are copied to a temporary directory before mounting, protecting your source files

## Copy Mode

When you enable copy mode with `--copy`, Codebox will:

1. Create a temporary copy of your workspace directory
2. Mount this temporary copy in the container instead of your original files
3. Run commands on the copy, so your original source files are never modified
4. Clean up the temporary directory **when the workspace token is closed**

Copy mode is useful for:

- Testing destructive operations safely
- Preventing accidental modifications to your source code
- Executing commands that might create temporary or build files
- Avoiding permission issues with mounted volumes

**Note:** Copy mode only works when using Docker images (with `--image`), not with existing containers (with `--container`). When using an existing container, the copy option is ignored.

## Troubleshooting

If you experience issues with Docker connectivity, ensure:

1. Docker is running
2. You have appropriate permissions
3. Containers are accessible

For detailed logs, set `"debug": true` in your `~/.codespin/codebox.json` file.

## License

MIT
