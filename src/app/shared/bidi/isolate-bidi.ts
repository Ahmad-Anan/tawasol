/**
 * Wraps user-generated text in Unicode FIRST STRONG ISOLATE … POP DIRECTIONAL ISOLATE, the plain-
 * text equivalent of `<bdi>`: the text takes its own direction and can't reorder the words around
 * it. For values interpolated into translated strings (e.g. "Unfollow {name}?"), where markup like
 * `<bdi>` can't go.
 */
export function isolateBidi(text: string): string {
  return `⁨${text}⁩`;
}
