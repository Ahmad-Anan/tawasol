import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { Comment } from '../comments.interface';
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
