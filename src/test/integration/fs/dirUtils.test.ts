// src/test/integration/fs/dirUtils.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  createTempDirectory,
  copyDirectory,
  removeDirectory,
} from "../../../fs/dirUtils.js";
import { setupTestEnvironment } from "../setup.js";

describe("Directory Utilities", function () {
  let testDir: string;
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function () {
    // Setup test environment
    const env = setupTestEnvironment();
    testDir = env.testDir;
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;

    // Create a few test files
    const file1 = path.join(workspaceDir, "file1.txt");
    fs.writeFileSync(file1, "File 1 content");

    // Create a nested directory with a file
    const nestedDir = path.join(workspaceDir, "nested");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, "file2.txt"), "File 2 content");
  });

  afterEach(function () {
    // Clean up test environment
    cleanup();
  });

  describe("createTempDirectory", function () {
    it("should create a temporary directory with the specified prefix", function () {
      const tempDir = createTempDirectory("test-prefix-");

      try {
        // Verify the directory exists
        expect(fs.existsSync(tempDir)).to.equal(true);
        expect(fs.statSync(tempDir).isDirectory()).to.equal(true);

        // Check if the prefix was used
        const dirName = path.basename(tempDir);
        expect(dirName.startsWith("test-prefix-")).to.equal(true);
      } finally {
        // Clean up the temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });

    it("should use the default prefix if none specified", function () {
      const tempDir = createTempDirectory();

      try {
        // Verify the directory exists
        expect(fs.existsSync(tempDir)).to.equal(true);

        // Check if the default prefix was used
        const dirName = path.basename(tempDir);
        expect(dirName.startsWith("codebox-")).to.equal(true);
      } finally {
        // Clean up the temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      }
    });
  });

  describe("copyDirectory", function () {
    it("should copy a directory and its contents", function () {
      const targetDir = path.join(testDir, "copy-target");

      // Copy the workspace directory to the target
      copyDirectory(workspaceDir, targetDir);

      // Verify the target directory exists
      expect(fs.existsSync(targetDir)).to.equal(true);

      // Verify the files were copied
      expect(fs.existsSync(path.join(targetDir, "file1.txt"))).to.equal(true);
      expect(
        fs.readFileSync(path.join(targetDir, "file1.txt"), "utf8")
      ).to.equal("File 1 content");

      // Verify nested directory and its files were copied
      expect(fs.existsSync(path.join(targetDir, "nested"))).to.equal(true);
      expect(
        fs.existsSync(path.join(targetDir, "nested", "file2.txt"))
      ).to.equal(true);
      expect(
        fs.readFileSync(path.join(targetDir, "nested", "file2.txt"), "utf8")
      ).to.equal("File 2 content");
    });

    it("should handle copying to an existing directory", function () {
      const targetDir = path.join(testDir, "existing-target");
      fs.mkdirSync(targetDir);

      // Create a file in the target dir that shouldn't be deleted
      fs.writeFileSync(path.join(targetDir, "existing.txt"), "Existing file");

      // Copy the workspace directory to the target
      copyDirectory(workspaceDir, targetDir);

      // Verify the existing file is still there
      expect(fs.existsSync(path.join(targetDir, "existing.txt"))).to.equal(
        true
      );
      expect(
        fs.readFileSync(path.join(targetDir, "existing.txt"), "utf8")
      ).to.equal("Existing file");

      // Verify the copied files are there too
      expect(fs.existsSync(path.join(targetDir, "file1.txt"))).to.equal(true);
      expect(
        fs.readFileSync(path.join(targetDir, "file1.txt"), "utf8")
      ).to.equal("File 1 content");
    });
  });

  describe("removeDirectory", function () {
    it("should remove a directory and all its contents", function () {
      const dirToRemove = path.join(testDir, "dir-to-remove");

      // Create a directory with some content
      fs.mkdirSync(dirToRemove, { recursive: true });
      fs.writeFileSync(path.join(dirToRemove, "test.txt"), "Test content");
      fs.mkdirSync(path.join(dirToRemove, "nested"), { recursive: true });
      fs.writeFileSync(
        path.join(dirToRemove, "nested", "nested.txt"),
        "Nested content"
      );

      // Verify the directory exists before removal
      expect(fs.existsSync(dirToRemove)).to.equal(true);

      // Remove the directory
      removeDirectory(dirToRemove);

      // Verify the directory no longer exists
      expect(fs.existsSync(dirToRemove)).to.equal(false);
    });

    it("should handle non-existent directories gracefully", function () {
      const nonExistentDir = path.join(testDir, "non-existent-dir");

      // Make sure the directory doesn't exist
      if (fs.existsSync(nonExistentDir)) {
        fs.rmdirSync(nonExistentDir, { recursive: true });
      }

      // This should not throw
      expect(() => removeDirectory(nonExistentDir)).to.not.throw();
    });
  });
});
