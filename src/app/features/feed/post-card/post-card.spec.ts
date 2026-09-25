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

describe('PostCard delete on the demo account', () => {
  let fixture: ComponentFixture<PostCard>;
  let deletePost: ReturnType<typeof vi.spyOn>;

  async function render(canDeletePost: (id: string) => boolean): Promise<void> {
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
        { provide: DemoAccountService, useValue: { isDemo: () => true, canDeletePost } },
      ],
    }).compileComponents();
    // The real PostsService (over the HTTP testing backend) — only deletePost is watched.
    deletePost = vi.spyOn(TestBed.inject(PostsService), 'deletePost').mockResolvedValue(undefined);
    fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput('post', makePost());
    fixture.detectChanges();
  }

  function openMenu(): HTMLButtonElement {
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="feed.postCard.moreOptions"]',
    );
    trigger.click();
    fixture.detectChanges();
    return [
      ...document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button[mat-menu-item]'),
    ].find((item) => item.textContent?.includes('feed.postCard.delete'))!;
  }

  afterEach(() =>
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = '')),
  );

  it("disables Delete with the note on the demo account's pre-existing post", async () => {
    await render(() => false);
    const item = openMenu();

    // Still reachable by keyboard (not [disabled]), dimmed, and its accessible name — the
    // item's text — carries the note.
    expect(item.hasAttribute('disabled')).toBe(false);
    expect(item.classList).toContain('delete-menu-item--disabled');
    expect(item.textContent).toContain('shared.demo.disabled');
  });

  it('never opens the delete confirmation for it, even if clicked', async () => {
    await render(() => false);
    openMenu().click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('feed.postCard.deleteConfirm');
    expect(deletePost).not.toHaveBeenCalled();
  });

  it('keeps Delete available for a post created during this session', async () => {
    await render((id) => id === 'p1');
    const item = openMenu();

    expect(item.classList).not.toContain('delete-menu-item--disabled');
    expect(item.textContent).not.toContain('shared.demo.disabled');

    item.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('feed.postCard.deleteConfirm');
  });
});
