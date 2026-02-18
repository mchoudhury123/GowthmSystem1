import { createHash } from "crypto";

/**
 * Compute a deterministic hash of the inputs that feed the LLM analysis.
 * If transcript, caption, and frame paths haven't changed, the hash stays
 * the same — so we can skip a redundant (and expensive) LLM call.
 */
export function computeAnalysisHash(
  transcript: string,
  caption: string,
  framePaths: string[]
): string {
  const input = [
    transcript.trim(),
    caption.trim(),
    ...framePaths.slice().sort(),
  ].join("|");
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}
