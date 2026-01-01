type LogLevel = "debug" | "info" | "warn" | "error";

type LoggerConfig = {
  level: LogLevel;
  prefix?: string;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function createLogger(config: LoggerConfig) {
  const currentLevel = LOG_LEVELS[config.level];
  const prefix = config.prefix ? `[${config.prefix}] ` : "";

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= currentLevel;
  }

  function formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${prefix}${message}`;
  }

  return {
    debug(message: string): void {
      if (shouldLog("debug")) {
        process.stderr.write(formatMessage("debug", message) + "\n");
      }
    },

    info(message: string): void {
      if (shouldLog("info")) {
        process.stderr.write(formatMessage("info", message) + "\n");
      }
    },

    warn(message: string): void {
      if (shouldLog("warn")) {
        process.stderr.write(formatMessage("warn", message) + "\n");
      }
    },

    error(message: string, error?: unknown): void {
      if (shouldLog("error")) {
        let msg = formatMessage("error", message);
        if (error instanceof Error) {
          msg += `: ${error.message}`;
        } else if (error !== undefined) {
          msg += `: ${String(error)}`;
        }
        process.stderr.write(msg + "\n");
      }
    },
  };
}

const logLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

export const logger = createLogger({ level: logLevel, prefix: "codebox" });
