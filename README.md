# Codebox

Built for LLM Agents to make code changes safely. Executes commands in Docker containers with local filesystem access scoped to project directories.

## What is MCP?

MCP (Model Context Protocol) is a standardized interface for tools that interact with LLMs, enabling structured function calling and context management.

## Install

```bash
npm install -g @codespin/codebox
```

Requires Node.js v16+, Docker daemon, Git.

## Architecture

- Commands execute in isolated Docker containers with volume mounts to project directories
- File operations are constrained to registered project paths
- Containers have network access but isolated filesystem

## Usage

```bash
# Initialize project with Docker image
# Creates .codespin/codebox.json with project config
codebox init --image node:18

# Register projects
codebox project add /path/to/project
codebox project list
codebox project remove /path/to/project

# Start MCP server
codebox start
```

## Docker Image Requirements

The Docker image must:

- Contain all development tools needed (compilers, interpreters, package managers)
- Have compatible versions with your project dependencies
- Be pre-built and available locally or in a registry

## Complete Workflow Example

```bash
# Setup project
mkdir my-project && cd my-project
git init
npm init -y

# Initialize codebox with Node.js image
codebox init --image node:18

# Register the project
codebox project add $(pwd)

# Start MCP server for agent interaction
codebox start
```

## MCP Tools

### execute_command

```typescript
{
  command: string; // Command to execute
  projectDir: string; // Absolute project path
}
```

### execute_batch_commands

```typescript
{
  projectDir: string; // Absolute project path
  commands: string[]; // Array of commands to execute in sequence
  stopOnError: boolean; // Optional: Whether to stop execution if a command fails (default: true)
}
```

The batch command tool allows executing multiple commands in sequence with a single LLM call, reducing API costs and improving efficiency. All commands run in the same Docker container session, preserving environment state between commands.

Example usage:
```json
{
  "projectDir": "/path/to/project",
  "commands": [
    "npm install",
    "npm test",
    "npm run build"
  ],
  "stopOnError": true
}
```

### write_file

```typescript
{
  projectDir: string; // Absolute project path
  filePath: string; // Relative path from project root
  content: string; // Content to write
  mode: "overwrite" | "append";
}
```

### list_projects

Lists registered projects with status.

### get_project_config

```typescript
{
  projectDir: string; // Absolute project path
}
```

## Agent Prompt

```
Codebox is Model Context Protocol (MCP) server for LLM Agents to make code changes to a project:
- Isolated command execution in Docker containers
- Safe file operations for code modifications
- Project-scoped access to prevent unauthorized changes

Use this for:
- Reading and modifying source code
- Running tests or build commands
- Executing project-specific development tools
- Code analysis and refactoring

Available tools:
- list_projects: See available projects
- execute_command: Run commands in project's Docker container
- execute_batch_commands: Run multiple commands in sequence with a single call
- write_file: Create or modify files
- get_project_config: Get project details

TOKEN USAGE WARNING:
Large directory listings or file contents can consume significant tokens. To avoid this:
1. Navigate directories incrementally (avoid recursive listings)
2. Skip dependency/build directories (node_modules, dist, target, etc)
3. Preview files before full reads
4. Request specific files rather than entire directories
5. Check file sizes before requesting full content (use 'wc -c <filename>' or 'ls -l')
6. Use execute_batch_commands for predictable command sequences

Efficient workflow example:
GOOD:
> list_projects
> execute_command {projectDir: "/path", command: "ls src"}
> execute_command {projectDir: "/path", command: "ls -l src/config.ts"} # Check file size
> execute_command {projectDir: "/path", command: "head -n 20 src/config.ts"}
> write_file {projectDir: "/path", filePath: "src/config.ts", content: "..."}
> execute_batch_commands {projectDir: "/path", commands: ["npm install", "npm test"]}

BAD (wastes tokens):
> execute_command {projectDir: "/path", command: "find . -type f"} // Lists everything
> execute_command {projectDir: "/path", command: "cat node_modules/package/README.md"}
> execute_command {projectDir: "/path", command: "cat src/large-file.ts"} // Without checking size first

Remember:
- Work incrementally through directories
- Avoid large file reads unless necessary, ask for permission as needed
- Check file sizes before requesting full content (files >100KB can waste many tokens)
- Commands execute in an isolated Docker container
- You must use write_file to write file content, instead of something like echoing to a file.
- If the user asks for the output of a command, you may print the output of execute_command verbatim in a markdown codeblock.
- Of course, if you know the sizes of files you're requesting (via a previous 'ls' for example), you don't need to ask every time.
- Use batch commands when you know a fixed sequence of commands needs to be executed. This saves API costs and time.
```

## License

MIT