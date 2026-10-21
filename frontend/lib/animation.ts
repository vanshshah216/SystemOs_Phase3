"use client";

/**
 * Calculates a smooth trapezoidal opacity curve for seamless scene transitions:
 * 0 -> fade in to 1 -> stay at 1 -> fade out to 0
 */
export function calcSceneOpacity(
  progress: number,
  start: number,
  fadeInEnd: number,
  fadeOutStart: number,
  end: number
): number {
  if (progress <= start || progress >= end) return 0;
  if (progress < fadeInEnd) {
    return Math.max(0, Math.min(1, (progress - start) / (fadeInEnd - start)));
  }
  if (progress <= fadeOutStart) {
    return 1;
  }
  return Math.max(0, Math.min(1, (end - progress) / (end - fadeOutStart)));
}

/**
 * Smooth local progress inside an active scene range (0 to 1)
 */
export function calcLocalProgress(progress: number, start: number, end: number): number {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}
