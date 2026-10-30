import { LiveAnnouncer } from '@angular/cdk/a11y';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { Comment } from '../comments.interface';
import { CommentsService } from '../services/comments.service';
import { CommentBody } from './comment-body';

const author = { _id: 'u1', name: 'Anan', username: 'anan', photo: 'https://example.com/a.png' };

describe('CommentBody timestamp', () => {
  it('shows the short format in a <time datetime>, with the full date in its title', async () => {
    await TestBed.configureTestingModule({
      imports: [CommentBody],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: { user: signal(author), isAuthenticated: () => true, token: () => null } },
      ],
    }).compileComponents();
    // Midday UTC in the current year, so the calendar day and year hold in any test-runner time zone.
    const createdAt = `${new Date().getFullYear()}-03-05T12:30:00.000Z`;
    const comment: Comment = {
      _id: 'c1',
      content: 'hello',
      commentCreator: author,
      post: 'p1',
      parentComment: null,
      likes: [],
      likesCount: 0,
      repliesCount: 0,
      createdAt,
    };
    const fixture = TestBed.createComponent(CommentBody);
    fixture.componentRef.setInput('comment', comment);
    fixture.componentRef.setInput('postId', 'p1');
    fixture.detectChanges();

    const time: HTMLTimeElement = fixture.nativeElement.querySelector('time');
    expect(time.getAttribute('datetime')).toBe(createdAt);
    expect(time.textContent?.trim()).toMatch(/^Mar 5, \d{1,2}:30\s?[AP]M$/); // no year for this year
    expect(time.title).toContain(`March 5, ${new Date().getFullYear()}`);
  });
});

describe('CommentBody like', () => {
  let toggleLike: ReturnType<typeof vi.spyOn>;
  let announce: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<CommentBody>>;

  beforeEach(async () => {
    announce = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [CommentBody],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: { user: signal(author), isAuthenticated: () => true, token: () => null } },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    }).compileComponents();
    toggleLike = vi.spyOn(TestBed.inject(CommentsService), 'toggleLike');
    fixture = TestBed.createComponent(CommentBody);
    fixture.componentRef.setInput('comment', {
      _id: 'c1',
      content: 'hello',
      commentCreator: { ...author, _id: 'someone-else' },
      post: 'p1',
      parentComment: null,
      likes: [],
      likesCount: 0,
      repliesCount: 0,
      createdAt: '2026-03-05T12:30:00.000Z',
    } satisfies Comment);
    fixture.componentRef.setInput('postId', 'p1');
    fixture.detectChanges();
  });

  const likeButton = (): HTMLButtonElement =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('comments.like'),
    )!;

  it('sends one request for a rapid double click and stays enabled meanwhile', async () => {
    let resolve!: () => void;
    toggleLike.mockReturnValue(new Promise<void>((r) => (resolve = r)));

    likeButton().click();
    likeButton().click();
    fixture.detectChanges();

    expect(toggleLike).toHaveBeenCalledTimes(1);
    expect(likeButton().disabled).toBe(false);
    resolve();
    await fixture.whenStable();
  });

  it('shows the error and announces it politely when the like fails (and is rolled back)', async () => {
    toggleLike.mockRejectedValue(new Error('boom'));

    likeButton().click();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('comments.errors.actionFailed');
    expect(announce).toHaveBeenCalledExactlyOnceWith('comments.errors.actionFailed', 'polite');
  });
});
