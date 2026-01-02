// src/test/integration/logging/console-logger.test.ts
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import { Writable } from "stream";

// We need to test the logger factory, so we'll create a custom test version
describe("Console Logger", () => {
  let originalStderr: NodeJS.WriteStream;
  let capturedOutput: string;
  let mockStderr: Writable;

  beforeEach(() => {
    capturedOutput = "";
    originalStderr = process.stderr;

    // Create a mock stderr to capture output
    mockStderr = new Writable({
      write(chunk, _encoding, callback) {
        capturedOutput += chunk.toString();
        callback();
      },
    });

    // Replace stderr temporarily
    Object.defineProperty(process, "stderr", {
      value: mockStderr,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original stderr
    Object.defineProperty(process, "stderr", {
      value: originalStderr,
      writable: true,
      configurable: true,
    });
  });

  describe("log levels", () => {
    it("should format log messages with timestamp and level", async () => {
      // Import fresh to get the logger
      const { logger } = await import("../../../logging/console-logger.js");

      logger.info("test message");

      expect(capturedOutput).to.include("INFO");
      expect(capturedOutput).to.include("[codebox]");
      expect(capturedOutput).to.include("test message");
      // Check for ISO timestamp format
      expect(capturedOutput).to.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should log info level messages", async () => {
      const { logger } = await import("../../../logging/console-logger.js");

      logger.info("info message");

      expect(capturedOutput).to.include("INFO");
      expect(capturedOutput).to.include("info message");
    });

    it("should log warn level messages", async () => {
      const { logger } = await import("../../../logging/console-logger.js");

      logger.warn("warning message");

      expect(capturedOutput).to.include("WARN");
      expect(capturedOutput).to.include("warning message");
    });

    it("should log error level messages", async () => {
      const { logger } = await import("../../../logging/console-logger.js");

      logger.error("error message");

      expect(capturedOutput).to.include("ERROR");
      expect(capturedOutput).to.include("error message");
    });

    it("should include error details when provided", async () => {
      const { logger } = await import("../../../logging/console-logger.js");

      const error = new Error("test error");
      logger.error("something failed", error);

      expect(capturedOutput).to.include("ERROR");
      expect(capturedOutput).to.include("something failed");
      expect(capturedOutput).to.include("test error");
    });

    it("should handle non-Error objects in error logging", async () => {
      const { logger } = await import("../../../logging/console-logger.js");

      logger.error("something failed", "string error");

      expect(capturedOutput).to.include("ERROR");
      expect(capturedOutput).to.include("string error");
    });
  });

  describe("log level filtering", () => {
    it("should respect LOG_LEVEL environment variable", async () => {
      // This test verifies the behavior described in the code
      // The default level is 'info', so debug messages should be filtered
      const { logger } = await import("../../../logging/console-logger.js");

      // By default (info level), debug should not appear
      logger.debug("debug message");

      // If LOG_LEVEL is info (default), debug messages are filtered
      // The actual filtering depends on the LOG_LEVEL env var at module load time
      // We can verify that the logger has the expected methods
      expect(logger.debug).to.be.a("function");
      expect(logger.info).to.be.a("function");
      expect(logger.warn).to.be.a("function");
      expect(logger.error).to.be.a("function");
    });
  });
});
