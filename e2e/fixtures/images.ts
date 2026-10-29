// Image URLs used by the fixtures. The host never resolves: e2e/support/mock-api.ts answers every
// request to it with PIXEL_PNG, so images load deterministically and offline.
export const IMAGE_HOST = 'https://images.tawasol.test';

export const IMAGES = {
  avatar: `${IMAGE_HOST}/avatar.png`,
  postPhoto: `${IMAGE_HOST}/post-photo.png`,
};

/** A valid 1×1 PNG. */
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
