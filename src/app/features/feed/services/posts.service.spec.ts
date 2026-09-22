import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/constants/api';
import type { FeedApiResponse, LikeToggleApiResponse, Post } from '../feed.interface';
import { PostsService } from './posts.service';

function makePost(overrides: Partial<Post> = {}): Post {
  const id = overrides.id ?? 'p1';
  return {
    _id: id,
    id,
    body: 'hello world',
    privacy: 'public',
    user: { _id: 'u1', name: 'Ahmed', username: 'ahmed', photo: '' },
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

function pageResponse(posts: Post[], nextPage?: number): FeedApiResponse {
  return {
    success: true,
    message: 'ok',
    data: { posts },
    meta: {
      feedMode: 'page',
      pagination: {
        currentPage: 1,
        limit: 10,
        total: posts.length,
        numberOfPages: 1,
        ...(nextPage !== undefined ? { nextPage } : {}),
      },
    },
  };
}

function cursorResponse(posts: Post[], hasMore: boolean): FeedApiResponse {
  return {
    success: true,
    message: 'ok',
    data: { posts },
    meta: { feedMode: 'cursor', cursor: { limit: 10, hasMore, nextCursor: hasMore ? 'next' : null } },
  };
}

describe('PostsService', () => {
  let service: PostsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PostsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function expectFeedRequest() {
    TestBed.tick();
    return httpMock.expectOne((req) => req.url === `${API_BASE_URL}/posts/feed`);
  }

  /**
   * Flushes a feed response and lets the resource's state (and the constructor's effect that
   * reads it) settle. `rxResource` applies its emission on a microtask, not synchronously
   * within `flush()`, so a plain `TestBed.tick()` right after `flush()` runs too early.
   */
  async function flushFeed(req: ReturnType<typeof httpMock.expectOne>, response: FeedApiResponse) {
    req.flush(response);
    await Promise.resolve();
    TestBed.tick();
  }

  it('does not request the feed until start() is called', () => {
    TestBed.tick();
    httpMock.expectNone((req) => req.url === `${API_BASE_URL}/posts/feed`);
  });

  it('requests the feed with the default "all" filter once started', async () => {
    service.start();
    const req = expectFeedRequest();
    expect(req.request.params.get('only')).toBe('all');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.has('cursor')).toBe(false);
    await flushFeed(req, pageResponse([makePost({ id: 'p1' })]));
  });

  it('populates posts and hasMore from a page-mode response', async () => {
    service.start();
    const req = expectFeedRequest();
    await flushFeed(req, pageResponse([makePost({ id: 'p1' }), makePost({ id: 'p2' })], 2));

    expect(service.posts().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(service.hasMore()).toBe(true);
  });

  it('treats a page-mode response with no nextPage as exhausted', async () => {
    service.start();
    const req = expectFeedRequest();
    await flushFeed(req, pageResponse([makePost({ id: 'p1' })]));

    expect(service.hasMore()).toBe(false);
  });

  it('appends (not replaces) posts when loadMore() fetches a cursor page', async () => {
    service.start();
    const first = expectFeedRequest();
    await flushFeed(first, cursorResponse([makePost({ id: 'p1' })], true));

    service.loadMore();
    const second = expectFeedRequest();
    expect(second.request.params.get('cursor')).toBe('p1');
    await flushFeed(second, cursorResponse([makePost({ id: 'p2' })], false));

    expect(service.posts().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(service.hasMore()).toBe(false);
  });

  it('does not fetch another page when hasMore is false', async () => {
    service.start();
    const req = expectFeedRequest();
    await flushFeed(req, cursorResponse([makePost({ id: 'p1' })], false));

    service.loadMore();
    TestBed.tick();
    httpMock.expectNone((r) => r.url === `${API_BASE_URL}/posts/feed`);
  });

  it('clears accumulated posts and re-fetches when the "only" filter changes', async () => {
    service.start();
    const first = expectFeedRequest();
    await flushFeed(first, cursorResponse([makePost({ id: 'p1' })], true));

    service.setOnlyFilter('following');
    const second = expectFeedRequest();
    expect(second.request.params.get('only')).toBe('following');
    expect(second.request.params.has('cursor')).toBe(false);
    await flushFeed(second, cursorResponse([makePost({ id: 'p2' })], false));

    // The old page's post is gone — resetPagination() cleared it before the new page arrived.
    expect(service.posts().map((p) => p.id)).toEqual(['p2']);
  });

  it('setOnlyFilter() is a no-op when the value is unchanged', async () => {
    service.start();
    const first = expectFeedRequest();
    await flushFeed(first, cursorResponse([makePost({ id: 'p1' })], false));

    service.setOnlyFilter('all');
    TestBed.tick();
    httpMock.expectNone((r) => r.url === `${API_BASE_URL}/posts/feed`);
  });

  it('sends hasImage only when a filter is actually set', async () => {
    service.start();
    const first = expectFeedRequest();
    expect(first.request.params.has('hasImage')).toBe(false);
    await flushFeed(first, cursorResponse([], false));

    service.setHasImageFilter(true);
    const second = expectFeedRequest();
    expect(second.request.params.get('hasImage')).toBe('true');
    await flushFeed(second, cursorResponse([], false));
  });

  describe('emptyStateKey', () => {
    it('picks the plain empty key by default', () => {
      expect(service.emptyStateKey()).toBe('feed.empty');
    });

    it('picks the filtered key when an image filter is active, regardless of "only"', () => {
      service.setHasImageFilter(true);
      expect(service.emptyStateKey()).toBe('feed.emptyFiltered');
    });

    it('picks the following/me keys based on the "only" filter', () => {
      service.setOnlyFilter('following');
      expect(service.emptyStateKey()).toBe('feed.emptyFollowing');

      service.setOnlyFilter('me');
      expect(service.emptyStateKey()).toBe('feed.emptyMe');
    });
  });

  it('toggleLike() patches only likes/likesCount on the affected post', async () => {
    service.start();
    const req = expectFeedRequest();
    await flushFeed(req, pageResponse([makePost({ id: 'p1', likes: [], likesCount: 0, body: 'original' })]));

    const promise = service.toggleLike('p1');
    const likeReq = httpMock.expectOne(`${API_BASE_URL}/posts/p1/like`);
    expect(likeReq.request.method).toBe('PUT');
    const response: LikeToggleApiResponse = {
      success: true,
      message: 'ok',
      data: {
        liked: true,
        likesCount: 1,
        post: {
          ...makePost({ id: 'p1' }),
          user: {
            _id: 'u1',
            name: 'A',
            username: 'a',
            photo: '',
            followersCount: 0,
            followingCount: 0,
            bookmarksCount: 0,
            id: 'u1',
          },
          likes: ['u1'],
        },
      },
    };
    likeReq.flush(response);
    await promise;

    const patched = service.posts()[0];
    expect(patched.likes).toEqual(['u1']);
    expect(patched.likesCount).toBe(1);
    // Untouched fields survive the patch.
    expect(patched.body).toBe('original');
  });

  it('toggleBookmark() patches only the bookmarked flag', async () => {
    service.start();
    const req = expectFeedRequest();
    await flushFeed(req, pageResponse([makePost({ id: 'p1', bookmarked: false })]));

    const promise = service.toggleBookmark('p1');
    const bookmarkReq = httpMock.expectOne(`${API_BASE_URL}/posts/p1/bookmark`);
    expect(bookmarkReq.request.method).toBe('PUT');
    bookmarkReq.flush({ success: true, message: 'ok', data: { bookmarked: true, bookmarksCount: 5 } });
    await promise;

    expect(service.posts()[0].bookmarked).toBe(true);
  });

  it('mergePosts() adds only posts not already known, leaving existing entries untouched', () => {
    service.mergePosts([makePost({ id: 'p1', body: 'first' })]);
    service.mergePosts([makePost({ id: 'p1', body: 'duplicate, should be ignored' }), makePost({ id: 'p2' })]);

    const ids = service.posts().map((p) => p.id);
    expect(ids).toEqual(['p1', 'p2']);
    expect(service.posts()[0].body).toBe('first');
  });

  it('isLikedBy() reflects whether the given user id is in the likes array', () => {
    const post = makePost({ likes: ['u1', 'u2'] });
    expect(service.isLikedBy(post, 'u1')).toBe(true);
    expect(service.isLikedBy(post, 'u3')).toBe(false);
    expect(service.isLikedBy(post, undefined)).toBe(false);
  });
});
