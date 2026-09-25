import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { CommentsService } from '../services/comments.service';
import { CommentComposer } from './comment-composer';

describe('CommentComposer', () => {
  let fixture: ComponentFixture<CommentComposer>;
  let commentsService: { addComment: ReturnType<typeof vi.fn>; addReply: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    commentsService = { addComment: vi.fn(), addReply: vi.fn() };
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();

    await TestBed.configureTestingModule({
      imports: [CommentComposer],
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: CommentsService, useValue: commentsService },
        { provide: AuthService, useValue: { user: () => null, isAuthenticated: () => true } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentComposer);
    fixture.componentRef.setInput('postId', 'p1');
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement;
  const textarea = (): HTMLTextAreaElement => el().querySelector('textarea')!;
  const postButton = (): HTMLButtonElement => el().querySelector('button[type="submit"]')!;
  const isDisabled = (): boolean => postButton().getAttribute('aria-disabled') === 'true';
  const shownError = (): string | null => el().querySelector('[role="alert"]')?.textContent?.trim() ?? null;

  function type(value: string): void {
    textarea().value = value;
    textarea().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  async function submit(): Promise<void> {
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('disables Post while empty or whitespace-only, with a screen-reader explanation', () => {
    expect(isDisabled()).toBe(true);
    const hintId = postButton().getAttribute('aria-describedby')!;
    expect(el().querySelector(`#${hintId}`)?.textContent).toContain('shared.composer.emptyHint');

    type('   ');
    expect(isDisabled()).toBe(true);

    type('Nice post');
    expect(isDisabled()).toBe(false);
  });

  it('never shows an "empty comment" error, even when submitted empty', async () => {
    await submit();
    expect(commentsService.addComment).not.toHaveBeenCalled();
    expect(shownError()).toBeNull();
  });

  it('gives every composer instance its own hint id', () => {
    const second = TestBed.createComponent(CommentComposer);
    second.componentRef.setInput('postId', 'p2');
    second.detectChanges();
    const secondId = second.nativeElement.querySelector('button[type="submit"]').getAttribute('aria-describedby');
    expect(secondId).not.toBe(postButton().getAttribute('aria-describedby'));
  });

  it('clears back to an empty, disabled composer after a successful comment', async () => {
    commentsService.addComment.mockResolvedValue(undefined);
    type('Nice post');
    await submit();

    expect(commentsService.addComment).toHaveBeenCalledWith('p1', { content: 'Nice post', image: null });
    expect(textarea().value).toBe('');
    expect(isDisabled()).toBe(true);
    expect(shownError()).toBeNull();
  });

  it('posts a reply when it is a reply composer', async () => {
    commentsService.addReply.mockResolvedValue(undefined);
    fixture.componentRef.setInput('parentCommentId', 'c1');
    type('Agreed');
    await submit();

    expect(commentsService.addReply).toHaveBeenCalledWith('p1', 'c1', { content: 'Agreed', image: null });
  });

  it('shows a real failure next to Post and keeps the text', async () => {
    commentsService.addComment.mockRejectedValue(new Error('network'));
    type('Nice post');
    await submit();

    expect(shownError()).toContain('comments.errors.actionFailed');
    expect(textarea().value).toBe('Nice post');
  });

  it('rejects a file that is not an image', () => {
    const input: HTMLInputElement = el().querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.txt', { type: 'text/plain' })] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(shownError()).toContain('shared.composer.errors.imageType');
    expect(isDisabled()).toBe(true);
  });
});
