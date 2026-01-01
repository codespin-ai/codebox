// Line utilities for reading files with line numbers and ranges

export type LineReadOptions = {
  fromLine?: number | undefined;
  toLine?: number | undefined;
  showLineNumbers?: boolean | undefined;
};

export type LineReadResult = {
  content: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
};

// Format a single line with a line number
export function formatLineWithNumber(
  line: string,
  lineNumber: number,
  maxLineDigits: number
): string {
  const paddedNumber = lineNumber.toString().padStart(maxLineDigits, " ");
  return `${paddedNumber}| ${line}`;
}

// Calculate the number of digits needed for line numbers
export function calculateMaxLineDigits(totalLines: number): number {
  return Math.max(1, Math.floor(Math.log10(totalLines)) + 1);
}

// Read file content with optional line range and line numbers
export function formatLinesWithNumbers(
  lines: string[],
  options: LineReadOptions = {}
): LineReadResult {
  const { fromLine = 1, toLine, showLineNumbers = true } = options;
  const totalLines = lines.length;

  // Validate and adjust line numbers
  const startLine = Math.max(1, fromLine);
  const endLine = toLine ? Math.min(toLine, totalLines) : totalLines;

  // Extract the line range (convert to 0-indexed for array access)
  const selectedLines = lines.slice(startLine - 1, endLine);
  const truncated = startLine > 1 || endLine < totalLines;

  // Format lines
  let content: string;
  if (showLineNumbers) {
    const maxDigits = calculateMaxLineDigits(endLine);
    const formattedLines = selectedLines.map((line, index) =>
      formatLineWithNumber(line, startLine + index, maxDigits)
    );
    content = formattedLines.join("\n");
  } else {
    content = selectedLines.join("\n");
  }

  return {
    content,
    startLine,
    endLine,
    totalLines,
    truncated,
  };
}

// Format the result summary
export function formatResultSummary(result: LineReadResult): string {
  const lines = [
    "---",
    `Lines: ${result.startLine}-${result.endLine} of ${result.totalLines} total`,
    `Truncated: ${result.truncated ? "Yes" : "No"}`,
  ];
  return lines.join("\n");
}

// Parse file content into lines
export function parseFileToLines(content: string): string[] {
  return content.split("\n");
}
