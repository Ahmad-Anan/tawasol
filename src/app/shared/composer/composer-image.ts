/**
 * Client-side cap on post/comment image uploads. The API documents no limit (see
 * docs/api-reference.md > POST /posts), so this is a deliberate app-side choice: large enough
 * for phone photos, small enough to keep uploads quick on mobile data. Change it here only.
 */
export const MAX_IMAGE_MB = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export type ComposerImageError = 'type' | 'size';

/**
 * Why a picked file can't be attached to a post/comment, or `null` if it can. The file input's
 * `accept="image/*"` is only a hint to the picker (users can choose "All files", and drag-and-drop
 * ignores it), so the type is checked again here.
 */
export function composerImageError(file: File): ComposerImageError | null {
  if (!file.type.startsWith('image/')) {
    return 'type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'size';
  }
  return null;
}
