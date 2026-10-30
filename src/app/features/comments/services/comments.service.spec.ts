import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import type { CommentListItem, CommentLikeToggleApiResponse } from '../comments.interface';
import { CommentsService } from './comments.service';

const ME = 'me';
const author = { _id: 'u1', name: 'Omar', username: 'omar', photo: '' };

const listItem: CommentListItem = {
  _id: 'c1',
  content: 'Nice post',
  commentCreator: author,
  post: 'p1',
  parentComment: null,
  likes: ['someone'],
  createdAt: '2026-09-01T10:00:00.000Z',
  repliesCount: 0,
};

describe('CommentsService optimistic comment like', () => {
  let service: CommentsService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: signal({ _id: ME }) } },
      ],
    });
    service = TestBed.inject(CommentsService);
    httpMock = TestBed.inject(HttpTestingController);

    const loaded = service.loadComments('p1');
    httpMock
      .expectOne((req) => req.url === `${API_BASE_URL}/posts/p1/comments`)
      .flush({
        success: true,
        message: 'ok',
        data: { comments: [listItem] },
        meta: { pagination: { currentPage: 1, limit: 10, total: 1, numberOfPages: 1 } },
      });
    await loaded;
  });

  afterEach(() => httpMock.verify());

  const comment = () => service.threadFor('p1')().comments[0];
  const likeUrl = `${API_BASE_URL}/posts/p1/comments/c1/like`;

  function likeResponse(liked: boolean, likesCount: number): CommentLikeToggleApiResponse {
    return {
      success: true,
      message: 'ok',
      data: {
        liked,
        likesCount,
        comment: {
          _id: 'c1',
          content: 'Nice post',
          commentCreator: {
            ...author,
            followersCount: 0,
            followingCount: 0,
            bookmarksCount: 0,
            id: 'u1',
          },
          post: 'p1',
          parentComment: null,
          // Not trusted (docs/api-reference.md): only `liked`/`likesCount` are.
          likes: ['stale'],
          createdAt: '2026-09-01T10:00:00.000Z',
          likesCount: 99,
          isReply: false,
          id: 'c1',
        },
      },
    };
  }

  it('likes immediately, then reconciles with the server count', async () => {
    const done = service.toggleLike('p1', 'c1', null);
    expect(comment().likes).toEqual(['someone', ME]);
    expect(comment().likesCount).toBe(2);

    const req = httpMock.expectOne(likeUrl);
    expect(req.request.method).toBe('PUT');
    req.flush(likeResponse(true, 3));
    await done;

    expect(comment().likes).toEqual(['someone', ME]);
    expect(comment().likesCount).toBe(3);
    // The thread's own fields (repliesCount isn't in the response) are kept.
    expect(comment().repliesCount).toBe(0);
  });

  it('rolls a failed like back to exactly the previous state and rethrows', async () => {
    const before = comment();
    const done = service.toggleLike('p1', 'c1', null);
    expect(comment().likesCount).toBe(2);

    httpMock
      .expectOne(likeUrl)
      .flush({ success: false, message: 'boom' }, { status: 500, statusText: 'Server Error' });

    await expect(done).rejects.toBeTruthy();
    expect(comment()).toEqual(before);
  });
});
