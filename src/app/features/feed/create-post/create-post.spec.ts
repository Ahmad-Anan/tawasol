import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MAX_IMAGE_BYTES } from '../../../shared/composer/composer-image';
import { PostsService } from '../services/posts.service';
import { CreatePost } from './create-post';

describe('CreatePost', () => {
  let fixture: ComponentFixture<CreatePost>;
  let postsService: { createPost: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    postsService = { createPost: vi.fn() };
    // jsdom has no object URLs; the image preview only needs *a* string.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CreatePost],
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: PostsService, useValue: postsService },
        { provide: AuthService, useValue: { user: () => null, isAuthenticated: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePost);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const textarea = (): HTMLTextAreaElement => el().querySelector('textarea')!;
  const postButton = (): HTMLButtonElement => el().querySelector('button[type="submit"]')!;
  const isDisabled = (): boolean => postButton().getAttribute('aria-disabled') === 'true';

  function type(value: string): void {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function attach(file: File): void {
    const input: HTMLInputElement = el().querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const shownError = (): string | null => el().querySelector('[role="alert"]')?.textContent?.trim() ?? null;

  describe('disabled state', () => {
    it('disables Post while the composer is empty, and says why to screen readers', () => {
      expect(isDisabled()).toBe(true);
      const hintId = postButton().getAttribute('aria-describedby');
      expect(hintId).toBeTruthy();
      expect(el().querySelector(`#${hintId}`)?.textContent).toContain('shared.composer.emptyHint');
    });

    it('keeps the disabled Post button focusable so screen readers can reach it', () => {
      expect(postButton().hasAttribute('disabled')).toBe(false);
    });

    it('treats whitespace-only text as empty', () => {
      type('   \n  ');
      expect(isDisabled()).toBe(true);
    });

    it('enables Post once there is text, and drops the "why disabled" description', () => {
      type('Hello Tawasol');
      expect(isDisabled()).toBe(false);
      expect(postButton().getAttribute('aria-describedby')).toBeNull();
    });

    it('enables Post for an image-only post', () => {
      attach(new File(['x'], 'photo.png', { type: 'image/png' }));
      expect(isDisabled()).toBe(false);
    });

    it('does nothing (and shows no error) when the disabled Post button is clicked', async () => {
      postButton().click();
      await submit();
      expect(postsService.createPost).not.toHaveBeenCalled();
      expect(shownError()).toBeNull();
    });

    it('shows no error when the empty field is focused and left', () => {
      textarea().dispatchEvent(new Event('focus'));
      textarea().dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(el().querySelector('mat-error')).toBeNull();
      expect(el().querySelector('.mat-form-field-invalid')).toBeNull();
    });
  });

  describe('after a successful post', () => {
    beforeEach(async () => {
      postsService.createPost.mockResolvedValue(undefined);
      type('  Hello Tawasol  ');
      textarea().dispatchEvent(new Event('blur'));
      await submit();
    });

    it('sends the trimmed text', () => {
      expect(postsService.createPost).toHaveBeenCalledWith({ body: 'Hello Tawasol', image: null });
    });

    it('resets to a clean, untouched composer with no error styling', () => {
      expect(textarea().value).toBe('');
      expect(isDisabled()).toBe(true);
      expect(shownError()).toBeNull();
      expect(el().querySelector('mat-error')).toBeNull();
      expect(el().querySelector('.mat-form-field-invalid')).toBeNull();
      expect(fixture.componentInstance['createForm']().touched()).toBe(false);
      expect(fixture.componentInstance['createForm']().dirty()).toBe(false);
    });
  });

  describe('real failures', () => {
    it('shows the API error next to Post and keeps the text so the user can retry', async () => {
      postsService.createPost.mockRejectedValue(
        new HttpErrorResponse({ status: 400, error: { success: false, message: 'post rejected' } }),
      );
      type('Hello');
      await submit();

      expect(shownError()).toBe('post rejected');
      expect(textarea().value).toBe('Hello');
    });

    it('shows a localized fallback when the API gives no message', async () => {
      postsService.createPost.mockRejectedValue(new Error('network'));
      type('Hello');
      await submit();

      expect(shownError()).toContain('feed.createPost.errors.unexpected');
    });

    it('rejects a file that is not an image', () => {
      attach(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
      expect(shownError()).toContain('shared.composer.errors.imageType');
      expect(isDisabled()).toBe(true);
    });

    it('rejects an image over the size limit', () => {
      attach(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' }));
      expect(shownError()).toContain('shared.composer.errors.imageSize');
      expect(isDisabled()).toBe(true);
    });
  });
});
