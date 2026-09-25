import { MAX_IMAGE_BYTES, composerImageError } from './composer-image';

function fileOf(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'upload', { type });
}

describe('composerImageError', () => {
  it('accepts an image within the size limit', () => {
    expect(composerImageError(fileOf('image/jpeg', 1024))).toBeNull();
    expect(composerImageError(fileOf('image/png', MAX_IMAGE_BYTES))).toBeNull();
  });

  it('rejects files that are not images', () => {
    expect(composerImageError(fileOf('application/pdf', 1024))).toBe('type');
    expect(composerImageError(fileOf('', 1024))).toBe('type');
  });

  it('rejects images over the size limit', () => {
    expect(composerImageError(fileOf('image/jpeg', MAX_IMAGE_BYTES + 1))).toBe('size');
  });
});
