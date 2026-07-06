import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Estimate token count from text (approximate: ~4 chars per token) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Copy text to clipboard with error handling.
 * Returns true on success, false on failure (insecure context, permission denied, etc.).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
