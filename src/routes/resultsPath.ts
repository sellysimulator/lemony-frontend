/**
 * The one results URL of a finished game (`pages/ResultsPage.tsx`): open to anyone holding its
 * public id, never expiring. The end screen and the owner's profile game page link to it.
 */
export function resultsPath(publicId: string): string {
  return `/results/${encodeURIComponent(publicId)}`
}
