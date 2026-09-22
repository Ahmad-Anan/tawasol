import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import type { FeedApiResponse, Post } from '../feed.interface';
import { FeedPage } from './feed-page';

function makePost(overrides: Partial<Post> = {}): Post {
  const id = overrides.id ?? 'p1';
  return {
    _id: id,
    id,
    body: 'hello world',
    privacy: 'public',
    user: { _id: 'u1', name: 'Ahmed', username: 'ahmed', photo: 'https://example.com/avatar.jpg' },
    sharedPost: null,
    likes: [],
    createdAt: new Date().toISOString(),
    commentsCount: 0,
    topComment: null,
    sharesCount: 0,
    likesCount: 0,
    isShare: false,
    bookmarked: false,
    ...overrides,
  };
}

/** Page-mode, no `nextPage` key — keeps hasMore() false so no scroll sentinel (and thus no
 *  IntersectionObserver, which jsdom doesn't implement) ever renders in these tests. */
function exhaustedPageResponse(posts: Post[]): FeedApiResponse {
  return {
    success: true,
    message: 'ok',
    data: { posts },
    meta: { feedMode: 'page', pagination: { currentPage: 1, limit: 10, total: posts.length, numberOfPages: 1 } },
  };
}

describe('FeedPage', () => {
  let fixture: ComponentFixture<FeedPage>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthService, useValue: { isAuthenticated: () => true, user: () => null, token: () => null } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FeedPage);
  });

  afterEach(() => {
    // Drain anything still outstanding (e.g. a suggestions retry) instead of a strict verify()
    // — this spec's focus is the feed itself, not every widget FeedPage happens to render.
    httpMock.match(() => true);
  });

  /**
   * Settles the fixture after a flush. Deliberately NOT `fixture.whenStable()`: that awaits
   * zoneless `ApplicationRef` stability, which also waits on the sibling `SuggestedFriends`
   * widget's own in-flight `GET /users/suggestions` (rxResource registers as a pending task) —
   * since these tests don't flush that request, `whenStable()` would hang until timeout.
   */
  async function settle(): Promise<void> {
    await Promise.resolve();
    TestBed.tick();
    fixture.detectChanges();
  }

  function flushFeedRequest(response: FeedApiResponse): void {
    TestBed.tick();
    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/posts/feed`);
    expect(req.request.params.get('only')).toBeTruthy();
    req.flush(response);
  }

  it('requests the feed (via PostsService.start()) as soon as it is created', () => {
    fixture.detectChanges();
    TestBed.tick();
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/posts/feed`).flush(exhaustedPageResponse([]));
  });

  it('renders one app-post-card per fetched post', async () => {
    fixture.detectChanges();
    flushFeedRequest(exhaustedPageResponse([makePost({ id: 'p1' }), makePost({ id: 'p2' })]));
    await settle();

    const cards = fixture.nativeElement.querySelectorAll('app-post-card');
    expect(cards.length).toBe(2);
  });

  it('shows the skeleton while the first page is loading', () => {
    fixture.detectChanges();
    TestBed.tick();
    httpMock.expectOne((r) => r.url === `${API_BASE_URL}/posts/feed`);

    const skeletons = fixture.nativeElement.querySelectorAll('app-post-card-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows an empty state (not the skeleton) once loaded with zero posts', async () => {
    fixture.detectChanges();
    flushFeedRequest(exhaustedPageResponse([]));
    await settle();

    expect(fixture.nativeElement.querySelectorAll('app-post-card-skeleton').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('app-post-card').length).toBe(0);
  });

  it('re-fetches with the new filter when the "only" toggle changes', async () => {
    fixture.detectChanges();
    flushFeedRequest(exhaustedPageResponse([makePost({ id: 'p1' })]));
    await settle();

    const followingToggle: HTMLElement = fixture.nativeElement.querySelector('mat-button-toggle[value="following"]');
    followingToggle.querySelector('button')?.dispatchEvent(new Event('click', { bubbles: true }));
    await settle();

    const req = httpMock.expectOne((r) => r.url === `${API_BASE_URL}/posts/feed`);
    expect(req.request.params.get('only')).toBe('following');
    req.flush(exhaustedPageResponse([]));
  });
});
