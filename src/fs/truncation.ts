// Response size truncation utilities

export type TruncationResult = {
  content: string;
  truncated: boolean;
  originalSizeKb: number;
  truncatedSizeKb: number;
};

// Truncate content to a maximum size in KB
export function truncateContent(content: string, maxSizeKb: number): TruncationResult {
  const originalSizeBytes = Buffer.byteLength(content, "utf-8");
  const originalSizeKb = originalSizeBytes / 1024;
  const maxSizeBytes = maxSizeKb * 1024;

  if (originalSizeBytes <= maxSizeBytes) {
    return {
      content,
      truncated: false,
      originalSizeKb,
      truncatedSizeKb: originalSizeKb,
    };
  }

  // Truncate at byte boundary, respecting UTF-8 character boundaries
  let truncatedContent = content;
  let currentBytes = originalSizeBytes;

  // Binary search for the right character count
  let low = 0;
  let high = content.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const slice = content.slice(0, mid);
    const sliceBytes = Buffer.byteLength(slice, "utf-8");

    if (sliceBytes <= maxSizeBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  truncatedContent = content.slice(0, low);
  currentBytes = Buffer.byteLength(truncatedContent, "utf-8");

  // Try to truncate at a newline boundary for better readability
  const lastNewline = truncatedContent.lastIndexOf("\n");
  if (lastNewline > truncatedContent.length * 0.8) {
    // Only use newline boundary if we don't lose too much content
    truncatedContent = truncatedContent.slice(0, lastNewline);
    currentBytes = Buffer.byteLength(truncatedContent, "utf-8");
  }

  return {
    content: truncatedContent,
    truncated: true,
    originalSizeKb,
    truncatedSizeKb: currentBytes / 1024,
  };
}

// Format truncation info for display
export function formatTruncationInfo(result: TruncationResult): string {
  if (!result.truncated) {
    return "";
  }
  return `\n[Content truncated: ${result.truncatedSizeKb.toFixed(1)}KB of ${result.originalSizeKb.toFixed(1)}KB shown]`;
}

// Get size of content in KB
export function getContentSizeKb(content: string): number {
  return Buffer.byteLength(content, "utf-8") / 1024;
}
