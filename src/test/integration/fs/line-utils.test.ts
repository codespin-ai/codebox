// src/test/integration/fs/line-utils.test.ts
import { expect } from "chai";
import { describe, it } from "mocha";
import {
  formatLineWithNumber,
  calculateMaxLineDigits,
  formatLinesWithNumbers,
  formatResultSummary,
  parseFileToLines,
} from "../../../fs/line-utils.js";

describe("Line Utilities", () => {
  describe("formatLineWithNumber", () => {
    it("should format a line with a line number", () => {
      const result = formatLineWithNumber("hello world", 1, 3);
      expect(result).to.equal("  1| hello world");
    });

    it("should pad line numbers correctly", () => {
      const result = formatLineWithNumber("test", 42, 4);
      expect(result).to.equal("  42| test");
    });

    it("should handle large line numbers", () => {
      const result = formatLineWithNumber("content", 1000, 4);
      expect(result).to.equal("1000| content");
    });

    it("should handle empty lines", () => {
      const result = formatLineWithNumber("", 5, 2);
      expect(result).to.equal(" 5| ");
    });
  });

  describe("calculateMaxLineDigits", () => {
    it("should return 1 for single digit totals", () => {
      expect(calculateMaxLineDigits(1)).to.equal(1);
      expect(calculateMaxLineDigits(9)).to.equal(1);
    });

    it("should return 2 for double digit totals", () => {
      expect(calculateMaxLineDigits(10)).to.equal(2);
      expect(calculateMaxLineDigits(99)).to.equal(2);
    });

    it("should return 3 for triple digit totals", () => {
      expect(calculateMaxLineDigits(100)).to.equal(3);
      expect(calculateMaxLineDigits(999)).to.equal(3);
    });

    it("should handle large numbers", () => {
      expect(calculateMaxLineDigits(10000)).to.equal(5);
    });
  });

  describe("parseFileToLines", () => {
    it("should split content by newlines", () => {
      const content = "line1\nline2\nline3";
      const result = parseFileToLines(content);
      expect(result).to.deep.equal(["line1", "line2", "line3"]);
    });

    it("should handle empty content", () => {
      const result = parseFileToLines("");
      expect(result).to.deep.equal([""]);
    });

    it("should handle content with trailing newline", () => {
      const content = "line1\nline2\n";
      const result = parseFileToLines(content);
      expect(result).to.deep.equal(["line1", "line2", ""]);
    });

    it("should handle single line content", () => {
      const result = parseFileToLines("single line");
      expect(result).to.deep.equal(["single line"]);
    });
  });

  describe("formatLinesWithNumbers", () => {
    const testLines = ["line 1", "line 2", "line 3", "line 4", "line 5"];

    it("should format all lines with line numbers by default", () => {
      const result = formatLinesWithNumbers(testLines);
      expect(result.content).to.include("1| line 1");
      expect(result.content).to.include("5| line 5");
      expect(result.startLine).to.equal(1);
      expect(result.endLine).to.equal(5);
      expect(result.totalLines).to.equal(5);
      expect(result.truncated).to.be.false;
    });

    it("should respect fromLine option", () => {
      const result = formatLinesWithNumbers(testLines, { fromLine: 3 });
      expect(result.content).to.include("3| line 3");
      expect(result.content).to.include("5| line 5");
      expect(result.content).to.not.include("1| line 1");
      expect(result.startLine).to.equal(3);
      expect(result.endLine).to.equal(5);
      expect(result.truncated).to.be.true;
    });

    it("should respect toLine option", () => {
      const result = formatLinesWithNumbers(testLines, { toLine: 3 });
      expect(result.content).to.include("1| line 1");
      expect(result.content).to.include("3| line 3");
      expect(result.content).to.not.include("4| line 4");
      expect(result.startLine).to.equal(1);
      expect(result.endLine).to.equal(3);
      expect(result.truncated).to.be.true;
    });

    it("should respect both fromLine and toLine", () => {
      const result = formatLinesWithNumbers(testLines, { fromLine: 2, toLine: 4 });
      expect(result.content).to.include("2| line 2");
      expect(result.content).to.include("4| line 4");
      expect(result.content).to.not.include("1| line 1");
      expect(result.content).to.not.include("5| line 5");
      expect(result.startLine).to.equal(2);
      expect(result.endLine).to.equal(4);
      expect(result.truncated).to.be.true;
    });

    it("should hide line numbers when showLineNumbers is false", () => {
      const result = formatLinesWithNumbers(testLines, { showLineNumbers: false });
      expect(result.content).to.equal("line 1\nline 2\nline 3\nline 4\nline 5");
      expect(result.content).to.not.include("|");
    });

    it("should handle out-of-bounds fromLine", () => {
      const result = formatLinesWithNumbers(testLines, { fromLine: 0 });
      expect(result.startLine).to.equal(1);
    });

    it("should handle out-of-bounds toLine", () => {
      const result = formatLinesWithNumbers(testLines, { toLine: 100 });
      expect(result.endLine).to.equal(5);
    });

    it("should handle empty lines array", () => {
      const result = formatLinesWithNumbers([]);
      expect(result.content).to.equal("");
      expect(result.totalLines).to.equal(0);
    });
  });

  describe("formatResultSummary", () => {
    it("should format a complete file summary", () => {
      const result = formatResultSummary({
        content: "test",
        startLine: 1,
        endLine: 10,
        totalLines: 10,
        truncated: false,
      });
      expect(result).to.include("Lines: 1-10 of 10 total");
      expect(result).to.include("Truncated: No");
    });

    it("should indicate truncation", () => {
      const result = formatResultSummary({
        content: "test",
        startLine: 5,
        endLine: 15,
        totalLines: 100,
        truncated: true,
      });
      expect(result).to.include("Lines: 5-15 of 100 total");
      expect(result).to.include("Truncated: Yes");
    });
  });
});
