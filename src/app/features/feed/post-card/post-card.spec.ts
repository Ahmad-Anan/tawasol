import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { DemoAccountService } from '../../../core/services/demo-account';
import type { Post } from '../feed.interface';
import { PostsService } from '../services/posts.service';
import { PostCard } from './post-card';

const me = { _id: 'me', name: 'Me', username: 'me', photo: 'https://example.com/me.png' };

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    _id: 'p1',
    id: 'p1',
    body: 'hello',
    privacy: 'public',
    user: me,
    sharedPost: null,
    likes: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    commentsCount: 0,
    topComment: null,
    sharesCount: 0,
    likesCount: 0,
    isShare: false,
    bookmarked: false,
    ...overrides,
  };
}

describe('PostCard Edit/Delete on the demo account', () => {
  let fixture: ComponentFixture<PostCard>;
  let deletePost: ReturnType<typeof vi.spyOn>;
  let editPost: ReturnType<typeof vi.spyOn>;

  async function render(canModifyPost: (id: string) => boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        {
          provide: AuthService,
          useValue: { user: signal(me), isAuthenticated: () => true, token: () => null },
        },
        { provide: DemoAccountService, useValue: { isDemo: () => true, canModifyPost } },
      ],
    }).compileComponents();
    // The real PostsService (over the HTTP testing backend) — only edit/delete are watched.
    const postsService = TestBed.inject(PostsService);
    deletePost = vi.spyOn(postsService, 'deletePost').mockResolvedValue(undefined);
    editPost = vi.spyOn(postsService, 'editPost').mockResolvedValue(undefined);
    fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput('post', makePost());
    fixture.detectChanges();
  }

  function openMenuItem(key: 'feed.postCard.edit' | 'feed.postCard.delete'): HTMLButtonElement {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="feed.postCard.moreOptions"]',
    );
    trigger.click();
    fixture.detectChanges();
    return [
      ...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]'),
    ].find((item) => item.textContent?.includes(key))!;
  }

  const isEditing = (): boolean => !!fixture.nativeElement.querySelector('textarea');

  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = '')),
  );

  describe("the demo account's pre-existing post", () => {
    beforeEach(() => render(() => false));

    for (const key of ['feed.postCard.edit', 'feed.postCard.delete'] as const) {
      it(`dims ${key.split('.').pop()} with the note, keeping it reachable`, () => {
        const item = openMenuItem(key);
        // Still reachable by keyboard (not [disabled]), dimmed, and its accessible name — the
        // item's text — carries the note.
        expect(item.hasAttribute('disabled')).toBe(false);
        expect(item.classList).toContain('menu-item--demo-locked');
        expect(item.textContent).toContain('shared.demo.disabled');
      });
    }

    it('never enters edit mode, even if Edit is clicked', () => {
      openMenuItem('feed.postCard.edit').click();
      fixture.detectChanges();
      expect(isEditing()).toBe(false);
    });

    it('refuses to save an edit even when the menu is bypassed', async () => {
      const card = fixture.componentInstance as unknown as {
        editBody: { set(v: string): void };
        saveEdit(): Promise<void>;
      };
      card.editBody.set('rewritten showcase text');
      await card.saveEdit();
      expect(editPost).not.toHaveBeenCalled();
    });

    it('never opens the delete confirmation, even if Delete is clicked', () => {
      openMenuItem('feed.postCard.delete').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain('feed.postCard.deleteConfirm');
      expect(deletePost).not.toHaveBeenCalled();
    });
  });

  describe('a post the demo account created during this session', () => {
    beforeEach(() => render((id) => id === 'p1'));

    for (const key of ['feed.postCard.edit', 'feed.postCard.delete'] as const) {
      it(`keeps ${key.split('.').pop()} available`, () => {
        const item = openMenuItem(key);
        expect(item.classList).not.toContain('menu-item--demo-locked');
        expect(item.textContent).not.toContain('shared.demo.disabled');
      });
    }

    it('can be edited and saved', async () => {
      openMenuItem('feed.postCard.edit').click();
      fixture.detectChanges();
      expect(isEditing()).toBe(true);

      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
      textarea.value = 'updated';
      textarea.dispatchEvent(new Event('input'));
      await (fixture.componentInstance as unknown as { saveEdit(): Promise<void> }).saveEdit();
      expect(editPost).toHaveBeenCalledWith('p1', { body: 'updated' });
    });

    it('can open the delete confirmation', () => {
      openMenuItem('feed.postCard.delete').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('feed.postCard.deleteConfirm');
    });
  });
});

describe('PostCard user-generated text direction', () => {
  it('lets the body, author name and top comment take their own direction, whatever the UI language', async () => {
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: { user: signal(me), isAuthenticated: () => true, token: () => null } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput(
      'post',
      makePost({
        body: 'الـ Signals في Angular غيرت طريقتي',
        user: { ...me, name: 'أحمد' },
        commentsCount: 1,
        topComment: {
          _id: 'c1',
          content: 'وكمان كتابة tests',
          commentCreator: { _id: 'u2', name: 'Anan', username: 'anan', photo: 'https://example.com/a.png' },
          post: 'p1',
          parentComment: null,
          likes: [],
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      }),
    );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const body = [...el.querySelectorAll('p')].find((p) => p.textContent?.trim() === 'الـ Signals في Angular غيرت طريقتي');
    expect(body?.getAttribute('dir')).toBe('auto');
    const isolated = [...el.querySelectorAll('bdi')].map((b) => b.textContent?.trim());
    expect(isolated).toContain('أحمد');
    expect(isolated).toContain('وكمان كتابة tests');
  });
});

describe('PostCard top comment preview', () => {
  it("keeps the author's name apart from the comment text instead of running them together", async () => {
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: { user: signal(me), isAuthenticated: () => true, token: () => null } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput(
      'post',
      makePost({
        commentsCount: 1,
        topComment: {
          _id: 'c1',
          content: 'ahmed',
          commentCreator: { _id: 'u2', name: 'ahmed', username: 'ahmed57', photo: 'https://example.com/a.png' },
          post: 'p1',
          parentComment: null,
          likes: [],
          createdAt: '2026-09-01T10:00:00.000Z',
        },
      }),
    );
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const author = el.querySelector('[data-testid="top-comment-author"]');
    const content = el.querySelector('[data-testid="top-comment-content"]');
    expect(author?.textContent?.trim()).toBe('ahmed');
    expect(author?.classList).toContain('block');
    expect(content?.textContent?.trim()).toBe('ahmed');
    expect(author?.contains(content ?? null)).toBe(false);
    expect(content?.contains(author)).toBe(false);
  });
});

describe('PostCard like and bookmark', () => {
  let fixture: ComponentFixture<PostCard>;
  let toggleLike: ReturnType<typeof vi.spyOn>;
  let toggleBookmark: ReturnType<typeof vi.spyOn>;
  let announce: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    announce = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        {
          provide: AuthService,
          useValue: { user: signal(me), isAuthenticated: () => true, token: () => null },
        },
        { provide: DemoAccountService, useValue: { isDemo: () => false, canModifyPost: () => true } },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    }).compileComponents();
    const postsService = TestBed.inject(PostsService);
    toggleLike = vi.spyOn(postsService, 'toggleLike');
    toggleBookmark = vi.spyOn(postsService, 'toggleBookmark');
    fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput('post', makePost({ user: { ...me, _id: 'author' } }));
    fixture.detectChanges();
  });

  const button = (label: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
  /** The action error shown under the buttons, if any. */
  const errorText = (): string | undefined =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('p')]
      .map((p) => p.textContent?.trim())
      .find((text) => text?.includes('errors.'));

  it('sends one request for a rapid double click, and the buttons stay enabled meanwhile', async () => {
    let resolve!: () => void;
    toggleLike.mockReturnValue(new Promise<void>((r) => (resolve = r)));

    button('feed.postCard.like').click();
    button('feed.postCard.like').click();
    fixture.detectChanges();

    expect(toggleLike).toHaveBeenCalledTimes(1);
    // Not [disabled]: disabling the focused button would drop keyboard focus mid-action.
    expect(button('feed.postCard.like').disabled).toBe(false);

    resolve();
    await fixture.whenStable();
    button('feed.postCard.like').click();
    expect(toggleLike).toHaveBeenCalledTimes(2);
  });

  it('shows the error and announces it politely when a like fails (and is rolled back)', async () => {
    toggleLike.mockRejectedValue(new Error('boom'));

    button('feed.postCard.like').click();
    await fixture.whenStable();

    expect(errorText()).toBe('feed.postCard.errors.actionFailed');
    expect(announce).toHaveBeenCalledExactlyOnceWith('feed.postCard.errors.actionFailed', 'polite');
  });

  it('does the same for a failed bookmark', async () => {
    toggleBookmark.mockRejectedValue(new Error('boom'));

    button('feed.postCard.bookmark').click();
    await fixture.whenStable();

    expect(errorText()).toBe('feed.postCard.errors.actionFailed');
    expect(announce).toHaveBeenCalledExactlyOnceWith('feed.postCard.errors.actionFailed', 'polite');
  });

  it('announces nothing when the action succeeds', async () => {
    toggleLike.mockResolvedValue(undefined);

    button('feed.postCard.like').click();
    await fixture.whenStable();

    expect(errorText()).toBeUndefined();
    expect(announce).not.toHaveBeenCalled();
  });
});
