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
