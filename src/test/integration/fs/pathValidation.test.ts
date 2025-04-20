// src/test/integration/fs/pathValidation.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  validateDirectory,
  validateFilePath,
  ensureDirectoryForFile,
} from "../../../fs/pathValidation.js";
import { setupTestEnvironment } from "../setup.js";

describe("Path Validation", function () {
  let testDir: string;
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("validateDirectory", function () {
    it("should not throw for valid directories", function () {
      expect(() => validateDirectory(workspaceDir)).to.not.throw();

      // Create and test a nested directory
      const nestedDir = path.join(workspaceDir, "nested");
      fs.mkdirSync(nestedDir);
      expect(() => validateDirectory(nestedDir)).to.not.throw();
    });

    it("should throw for non-existent directories", function () {
      const nonExistentDir = path.join(testDir, "non-existent");
      expect(() => validateDirectory(nonExistentDir)).to.throw(
        "Directory not found"
      );
    });

    it("should throw for file paths", function () {
      // Create a file that is not a directory
      const filePath = path.join(workspaceDir, "file.txt");
      fs.writeFileSync(filePath, "content");

      expect(() => validateDirectory(filePath)).to.throw(
        "Path is not a directory"
      );
    });
  });

  describe("validateFilePath", function () {
    it("should return true for file paths within project directory", function () {
      // Simple file path
      expect(validateFilePath(workspaceDir, "file.txt")).to.equal(true);

      // Nested file path
      expect(validateFilePath(workspaceDir, "nested/file.txt")).to.equal(true);
    });

    it("should return false for file paths outside project directory", function () {
      // Absolute path outside project
      expect(validateFilePath(workspaceDir, "/etc/passwd")).to.equal(false);

      // Relative path outside project using parent directory traversal
      expect(validateFilePath(workspaceDir, "../outside.txt")).to.equal(false);

      // Path with directory traversal
      expect(validateFilePath(workspaceDir, "nested/../../outside.txt")).to.equal(
        false
      );
    });
  });

  describe("ensureDirectoryForFile", function () {
    it("should create all parent directories for a file path", function () {
      const filePath = path.join(workspaceDir, "a/b/c/file.txt");

      ensureDirectoryForFile(filePath);

      // Check that all directories were created
      const dirPath = path.dirname(filePath);
      expect(fs.existsSync(dirPath)).to.equal(true);
      expect(fs.statSync(dirPath).isDirectory()).to.equal(true);
    });

    it("should work with existing directories", function () {
      // Create a directory manually
      const dirPath = path.join(workspaceDir, "existing");
      fs.mkdirSync(dirPath);

      const filePath = path.join(dirPath, "file.txt");

      // This should not throw
      expect(() => ensureDirectoryForFile(filePath)).to.not.throw();
    });
  });
});
