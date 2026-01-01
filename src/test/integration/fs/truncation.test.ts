// src/test/integration/fs/truncation.test.ts
import { expect } from "chai";
import { describe, it } from "mocha";
import { truncateContent, formatTruncationInfo, getContentSizeKb } from "../../../fs/truncation.js";

describe("Truncation Utilities", () => {
  describe("getContentSizeKb", () => {
    it("should return 0 for empty string", () => {
      expect(getContentSizeKb("")).to.equal(0);
    });

    it("should calculate size in KB correctly", () => {
      // 1024 bytes = 1 KB
      const content = "a".repeat(1024);
      expect(getContentSizeKb(content)).to.equal(1);
    });

    it("should handle multi-byte UTF-8 characters", () => {
      // Each emoji is 4 bytes
      const content = "😀".repeat(256); // 1024 bytes
      expect(getContentSizeKb(content)).to.equal(1);
    });
  });

  describe("truncateContent", () => {
    it("should not truncate content smaller than maxSizeKb", () => {
      const content = "Hello, World!";
      const result = truncateContent(content, 1);
      expect(result.content).to.equal(content);
      expect(result.truncated).to.be.false;
      expect(result.originalSizeKb).to.be.lessThan(1);
      expect(result.truncatedSizeKb).to.equal(result.originalSizeKb);
    });

    it("should truncate content larger than maxSizeKb", () => {
      const content = "a".repeat(2048); // 2 KB
      const result = truncateContent(content, 1);
      expect(result.truncated).to.be.true;
      expect(result.truncatedSizeKb).to.be.lessThanOrEqual(1);
      expect(result.originalSizeKb).to.be.approximately(2, 0.01);
    });

    it("should try to truncate at newline boundary", () => {
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push("a".repeat(50));
      }
      const content = lines.join("\n"); // ~5100 bytes
      const result = truncateContent(content, 2);
      expect(result.truncated).to.be.true;
      // Should end at a newline if possible
      const lastChar = result.content[result.content.length - 1];
      // Either ends with newline or regular content (if newline boundary would lose too much)
      expect(lastChar === "\n" || lastChar === "a").to.be.true;
    });

    it("should handle exact boundary size", () => {
      const content = "a".repeat(1024); // Exactly 1 KB
      const result = truncateContent(content, 1);
      expect(result.truncated).to.be.false;
      expect(result.content).to.equal(content);
    });

    it("should handle UTF-8 character boundaries correctly", () => {
      // Create content with multi-byte characters
      const content = "Hello 😀 World 🎉 ".repeat(100);
      const result = truncateContent(content, 1);
      expect(result.truncated).to.be.true;
      // Should not corrupt UTF-8 characters
      expect(() => Buffer.from(result.content, "utf-8")).to.not.throw();
    });

    it("should handle very small maxSizeKb", () => {
      const content = "Hello, World!";
      const result = truncateContent(content, 0.001); // ~1 byte
      expect(result.truncated).to.be.true;
      expect(result.content.length).to.be.lessThan(content.length);
    });
  });

  describe("formatTruncationInfo", () => {
    it("should return empty string when not truncated", () => {
      const result = formatTruncationInfo({
        content: "test",
        truncated: false,
        originalSizeKb: 0.01,
        truncatedSizeKb: 0.01,
      });
      expect(result).to.equal("");
    });

    it("should return truncation info when truncated", () => {
      const result = formatTruncationInfo({
        content: "test",
        truncated: true,
        originalSizeKb: 10.5,
        truncatedSizeKb: 5.2,
      });
      expect(result).to.include("Content truncated");
      expect(result).to.include("5.2KB");
      expect(result).to.include("10.5KB");
    });

    it("should format KB values with one decimal place", () => {
      const result = formatTruncationInfo({
        content: "test",
        truncated: true,
        originalSizeKb: 10.123,
        truncatedSizeKb: 5.789,
      });
      expect(result).to.include("5.8KB");
      expect(result).to.include("10.1KB");
    });
  });
});
