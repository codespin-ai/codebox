// src/test/integration/fs/gitignore.test.ts
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { describe, it, beforeEach, afterEach } from "mocha";
import { createGitignoreFilter, shouldIgnore, filterByGitignore } from "../../../fs/gitignore.js";
import { setupTestEnvironment } from "../setup.js";

describe("Gitignore Utilities", () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    testEnv = setupTestEnvironment();
  });

  afterEach(() => {
    testEnv.cleanup();
  });

  describe("createGitignoreFilter", () => {
    it("should return null when no .gitignore exists", () => {
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(ig).to.be.null;
    });

    it("should return an Ignore instance when .gitignore exists", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "node_modules\n");
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(ig).to.not.be.null;
    });

    it("should parse .gitignore patterns correctly", () => {
      fs.writeFileSync(
        path.join(testEnv.workspaceDir, ".gitignore"),
        "node_modules\n*.log\ndist/\n"
      );
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(ig).to.not.be.null;
      expect(ig!.ignores("node_modules")).to.be.true;
      expect(ig!.ignores("error.log")).to.be.true;
      expect(ig!.ignores("dist/file.js")).to.be.true;
      expect(ig!.ignores("src/index.ts")).to.be.false;
    });

    it("should handle comments and empty lines in .gitignore", () => {
      fs.writeFileSync(
        path.join(testEnv.workspaceDir, ".gitignore"),
        "# This is a comment\n\nnode_modules\n\n# Another comment\n*.log\n"
      );
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(ig).to.not.be.null;
      expect(ig!.ignores("node_modules")).to.be.true;
      expect(ig!.ignores("error.log")).to.be.true;
    });

    it("should handle negation patterns", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\n!important.log\n");
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(ig).to.not.be.null;
      expect(ig!.ignores("error.log")).to.be.true;
      expect(ig!.ignores("important.log")).to.be.false;
    });
  });

  describe("shouldIgnore", () => {
    it("should return false when respectGitignore is false", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\n");
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(shouldIgnore("error.log", ig, false)).to.be.false;
    });

    it("should return false when ig is null", () => {
      expect(shouldIgnore("error.log", null, true)).to.be.false;
    });

    it("should return true for ignored files when respectGitignore is true", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\n");
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(shouldIgnore("error.log", ig, true)).to.be.true;
    });

    it("should return false for non-ignored files", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\n");
      const ig = createGitignoreFilter(testEnv.workspaceDir);
      expect(shouldIgnore("index.ts", ig, true)).to.be.false;
    });
  });

  describe("filterByGitignore", () => {
    it("should return all paths when respectGitignore is false", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\n");
      const paths = [
        path.join(testEnv.workspaceDir, "error.log"),
        path.join(testEnv.workspaceDir, "index.ts"),
      ];
      const result = filterByGitignore(paths, testEnv.workspaceDir, false);
      expect(result).to.have.lengthOf(2);
    });

    it("should return all paths when no .gitignore exists", () => {
      const paths = [
        path.join(testEnv.workspaceDir, "error.log"),
        path.join(testEnv.workspaceDir, "index.ts"),
      ];
      const result = filterByGitignore(paths, testEnv.workspaceDir, true);
      expect(result).to.have.lengthOf(2);
    });

    it("should filter out ignored paths", () => {
      fs.writeFileSync(path.join(testEnv.workspaceDir, ".gitignore"), "*.log\nnode_modules/\n");
      const paths = [
        path.join(testEnv.workspaceDir, "error.log"),
        path.join(testEnv.workspaceDir, "index.ts"),
        path.join(testEnv.workspaceDir, "node_modules", "package.json"),
      ];
      const result = filterByGitignore(paths, testEnv.workspaceDir, true);
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.include("index.ts");
    });
  });
});
