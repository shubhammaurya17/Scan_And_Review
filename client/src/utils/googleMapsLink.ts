/**
 * Generates the best Google review URL for the current platform.
 *
 * On iOS, uses a Google Maps Universal Link that the OS can intercept
 * and open in the Maps app (where the user is likely already signed in).
 * On all other platforms, returns the original URL unchanged.
 *
 * The `writereview` URL is the most direct path, but on iOS it opens
 * in Safari where the user may not be logged in. The Maps Universal Link
 * opens in the Maps app but lands on the place page (user taps "Write a review").
 *
 * Easy to revert: just stop calling this function and use the original URL.
 */
export function getGoogleReviewUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isIOS) return originalUrl;

  // Try to extract the place ID from the writereview URL
  // e.g. https://search.google.com/local/writereview?placeid=ChIJ_abc123
  try {
    const url = new URL(originalUrl);
    const placeId = url.searchParams.get('placeid');
    if (placeId) {
      // Google Maps Universal Link — iOS will open this in the Maps app if installed
      return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`;
    }
  } catch {
    // URL parsing failed — fall through to original
  }

  return originalUrl;
}
