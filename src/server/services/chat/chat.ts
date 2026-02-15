/**
 * Pure utility functions for chat. DB operations moved to ChatRepository.
 */

export function generateTitle(firstMessage: string): string {
  let title = firstMessage
    .replace(/\?/g, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+(is|are|do|does|me|I|my)\s+(my\s+)?/i, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+/i, "")
    .trim();

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate
  if (title.length > 50) {
    title = title.slice(0, 50) + "...";
  }

  return title;
}
