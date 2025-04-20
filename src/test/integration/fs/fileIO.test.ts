// src/test/integration/fs/fileIO.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import {
  writeProjectFile,
  readProjectFile,
  projectFileExists
} from "../../../fs/fileIO.js";
import { setupTestEnvironment } from "../setup.js";

describe("File I/O Operations", function() {
  let workspaceDir: string;
  let cleanup: () => void;

  beforeEach(function() {
    // Setup test environment
    const env = setupTestEnvironment();
    workspaceDir = env.workspaceDir;
    cleanup = env.cleanup;
  });

  afterEach(function() {
    // Clean up test environment
    cleanup();
  });

  describe("writeProjectFile", function() {
    it("should write content to a file in the project directory", function() {
      const filePath = "test.txt";
      const content = "Hello, world!";
      
      writeProjectFile(workspaceDir, filePath, content);
      
      const fullPath = path.join(workspaceDir, filePath);
      expect(fs.existsSync(fullPath)).to.equal(true);
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should create directory structure if needed", function() {
      const filePath = "nested/dir/test.txt";
      const content = "Nested file content";
      
      writeProjectFile(workspaceDir, filePath, content);
      
      const fullPath = path.join(workspaceDir, filePath);
      expect(fs.existsSync(fullPath)).to.equal(true);
      expect(fs.readFileSync(fullPath, "utf8")).to.equal(content);
    });

    it("should append content to an existing file when mode is 'append'", function() {
      const filePath = "append.txt";
      const initialContent = "Initial content\n";
      const appendContent = "Appended content";
      
      // First write
      writeProjectFile(workspaceDir, filePath, initialContent);
      
      // Append to the file
      writeProjectFile(workspaceDir, filePath, appendContent, "append");
      
      const fullPath = path.join(workspaceDir, filePath);
      expect(fs.readFileSync(fullPath, "utf8"))
        .to.equal(initialContent + appendContent);
    });

    it("should throw an error for paths outside the project directory", function() {
      const filePath = "../outside.txt";
      const content = "This should fail";
      
      expect(() => writeProjectFile(workspaceDir, filePath, content))
        .to.throw("Invalid file path");
    });
  });

  describe("readProjectFile", function() {
    it("should read content from a file in the project directory", function() {
      const filePath = "read.txt";
      const content = "Content to read";
      
      // Create the file first
      const fullPath = path.join(workspaceDir, filePath);
      fs.writeFileSync(fullPath, content, "utf8");
      
      // Read it back
      const readContent = readProjectFile(workspaceDir, filePath);
      expect(readContent).to.equal(content);
    });

    it("should throw an error for non-existent files", function() {
      const filePath = "non-existent.txt";
      
      expect(() => readProjectFile(workspaceDir, filePath))
        .to.throw("File not found");
    });

    it("should throw an error for paths outside the project directory", function() {
      const filePath = "../outside.txt";
      
      expect(() => readProjectFile(workspaceDir, filePath))
        .to.throw("Invalid file path");
    });
  });

  describe("projectFileExists", function() {
    it("should return true for existing files", function() {
      const filePath = "exists.txt";
      
      // Create the file
      const fullPath = path.join(workspaceDir, filePath);
      fs.writeFileSync(fullPath, "test content", "utf8");
      
      expect(projectFileExists(workspaceDir, filePath)).to.equal(true);
    });

    it("should return false for non-existent files", function() {
      const filePath = "not-exists.txt";
      
      expect(projectFileExists(workspaceDir, filePath)).to.equal(false);
    });

    it("should return false for paths outside the project directory", function() {
      const filePath = "../outside.txt";
      
      expect(projectFileExists(workspaceDir, filePath)).to.equal(false);
    });
  });
});