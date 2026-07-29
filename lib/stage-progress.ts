// Star rating awarded for a completed stage, based on accuracy percentage (0-100).
export function computeStars(accuracyPercent: number): number {
  if (accuracyPercent >= 100) return 3
  if (accuracyPercent >= 80) return 2
  if (accuracyPercent >= 60) return 1
  return 0
}
