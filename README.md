# Codebox

Codebox is an MCP Server for running commands within Docker containers for **specific workspaces**. It simplifies the process of executing code and commands in isolated, reproducible environments.

## Installation

```bash
npm install -g @codespin/codebox
```

## Usage

### Configure your MCP Client (such as LibreChat, Claude Desktop)

#### 1 STDIO transport — start the server on **stdin/stdout**

```bash
codebox start
```

For LibreChat:

```yaml
mcpServers:
  codebox:
    type: stdio
    command: codebox
    args:
      - start
    timeout: 30000 # 30-second timeout for commands
    initTimeout: 10000 # 10-second timeout for initialization
```

#### 2 HTTP/Stream transport — start the server over HTTP

```bash
codebox http --host 127.0.0.1 --port 13014 --allowed-origins http://localhost:3000
```

_Options_

| Flag                | Default                   | Purpose                                          |
| ------------------- | ------------------------- | ------------------------------------------------ |
| `--host`            | `127.0.0.1`               | Host to bind                                     |
| `--port`            | `13014`                   | Port to listen on                                |
| `--allowed-origins` | `http://localhost:<port>` | Allowed origins for CORS (`*` to allow all)      |
| `--idle-timeout`    | `1800000` (30 minutes)    | Auto-close idle HTTP sessions after milliseconds |

> The HTTP endpoint is `/mcp`. An MCP client (e.g. `@modelcontextprotocol/sdk`’s `StreamableHTTPClientTransport`) should send the initialize request, receive a `mcp-session-id` header, and include that header on subsequent requests.

### Managing Workspaces

#### Adding a Workspace

Register a workspace directory with Codebox:

```bash
# Using a Docker image
codebox workspace add [dirname] --image <image_name> [options]

# Using an existing container
codebox workspace add [dirname] --container <container_name> [options]
```

_Common options:_

| Flag                    | Purpose                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `--image <name>`        | Docker image to use for new containers                                                    |
| `--container <name>`    | Name of an existing Docker container to exec into                                         |
| `--name <workspace>`    | Custom name for the workspace (defaults to the directory name)                            |
| `--containerPath <p>`   | Path inside the container to mount the workspace (default `/workspace`)                   |
| `--network <net>`       | Docker network to connect the container to (useful in Docker Compose environments)        |
| `--copy`                | Copy workspace files to a temporary directory before mounting                             |
| `--idle-timeout <ms>`   | Timeout in milliseconds before automatically closing idle workspace tokens (0 to disable) |
| `--run-template <tpl>`  | Custom template for `docker run` commands                                                 |
| `--exec-template <tpl>` | Custom template for `docker exec` commands                                                |

_Examples:_

```bash
# Register current directory, auto-close tokens after 5 min idle
codebox workspace add --image node:18 --idle-timeout 300000

# Register with copy mode and custom run template
codebox workspace add /path/to/app --image node:18 --copy \
  --run-template "docker run -i --rm -v \"{{path}}:{{containerPath}}\" --workdir=\"{{containerPath}}\" --user={{uid}}:{{gid}} {{image}} /bin/sh -c \"{{command}}\""
```

#### Listing Workspaces

```bash
codebox workspace list
```

#### Removing a Workspace

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
2. **Open a workspace** via `open_workspace`; returns a workspace token (and a temp copy if `copy=true`).
3. **Execute commands** with `execute_command` or `execute_batch_commands`, passing the token.
4. **Read or write files** with `write_file` or `write_batch_files`.
5. **Close the workspace** with `close_workspace`; cleans up any temporary directories immediately.

> Workspace tokens may be closed automatically after their `idleTimeout` expires; clients should handle token expiration and re-open if necessary.

## Workspace Configuration

Workspaces are stored in `~/.codespin/codebox.json`:

```json
{
  "workspaces": [
    {
      "name": "my-node-app",
      "path": "/home/user/workspaces/my-node-app",
      "containerPath": "/my-project",
      "image": "node:18",
      "network": "my_compose_network",
      "copy": true,
      "idleTimeout": 300000,
      "runTemplate": "docker run -i --rm -v \"{{path}}:{{containerPath}}\" --workdir=\"{{containerPath}}\" {{image}} /bin/sh -c \"{{command}}\""
    }
  ],
  "debug": true
}
```

**Fields**

- `name`: Identifier for the workspace
- `path`: Host path to the workspace directory
- `containerPath`: (Optional) Path inside container (defaults to `/workspace`)
- `image`: Docker image for new containers
- `containerName`: Name of an existing container
- `network`: Docker network to join
- `copy`: When `true`, creates a temp copy before mounting
- `idleTimeout`: Timeout in ms before auto-closing tokens (0 = disabled; default 600 000)
- `runTemplate`, `execTemplate`: Custom command templates
- `debug`: When `true`, enables verbose MCP logging under `~/.codespin/logs/`

## Copy Mode

When you enable copy mode with `--copy`, Codebox will:

1. Create a temporary copy of your workspace directory
2. Mount this temporary copy in the container instead of your original files
3. Run commands on the copy, so your original source files are never modified
4. Clean up the temporary directory **when the workspace token is closed or the idle-timeout fires**

Copy mode is useful for:

- Testing destructive operations safely
- Preventing accidental modifications to your source code
- Executing commands that might create temporary or build files
- Avoiding permission issues with mounted volumes

**Note:** Copy mode only works with Docker images (`--image`), not existing containers (`--container`).

## Command Templates

### Run Template Variables

When using `--run-template` with a workspace that uses `--image`, you can use these variables:

- `{{image}}` — The Docker image name
- `{{path}}` — The host directory path
- `{{containerPath}}` — The path inside the container
- `{{command}}` — The command to execute (escaped)
- `{{network}}` — The Docker network, if specified
- `{{uid}}`, `{{gid}}` — Host user/group IDs for `--user`

### Exec Template Variables

When using `--exec-template` with a workspace that uses `--container`, you can use these variables:

- `{{containerName}}` — The container name
- `{{containerPath}}` — The working directory inside the container
- `{{command}}` — The command to execute (escaped)
- `{{uid}}`, `{{gid}}` — Host user/group IDs for `--user`

### Example Use Cases

- **Alternative container runtime**

  ```bash
  codebox workspace add --image alpine:latest \
    --run-template "podman run -i --rm -v {{path}}:{{containerPath}} {{image}} sh -c \"{{command}}\""
  ```

- **Custom Docker options**

  ```bash
  codebox workspace add --image node:18 \
    --run-template "docker run -i --rm -v \"{{path}}:{{containerPath}}\" --workdir=\"{{containerPath}}\" --memory=512m --cpus=0.5 {{image}} /bin/sh -c \"{{command}}\""
  ```

## Troubleshooting

1. **HTTP / CORS** — If you see `Origin not allowed`, adjust `--allowed-origins` (or use `*` in dev).
2. **Debug logging** — Set `"debug": true` in `~/.codespin/codebox.json`; logs appear in `~/.codespin/logs/<YYYY-MM-DD>.log`.
3. **Docker connectivity** — Ensure Docker is running, you have proper permissions, and specified containers/networks exist.
4. **Idle workspace closed** — If tokens disappear, increase or disable their `idleTimeout`.

## License

MIT
