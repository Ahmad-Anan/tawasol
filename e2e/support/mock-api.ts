import type { Page, Request, Route } from '@playwright/test';
import {
  COMMENT_ON_OMAR,
  NOW,
  initialNotifications,
  initialPosts,
  type FixtureComment,
  type FixtureNotification,
  type FixturePost,
} from '../fixtures/content';
import { MATERIAL_ICONS_PATH, MATERIAL_ICONS_WOFF2 } from '../fixtures/fonts';
import { IMAGE_HOST, PIXEL_PNG } from '../fixtures/images';
import {
  ALL_USERS,
  DEMO,
  DEMO_CREDENTIALS,
  LAYLA,
  LAYLA_PASSWORD,
  author,
  authorWithStats,
  sessionUser,
  type FixtureUser,
} from '../fixtures/users';

/** Must match src/app/core/constants/api.ts. */
export const API_BASE_URL = 'https://route-posts.routemisr.com';

export interface ApiCall {
  method: string;
  path: string;
  query: URLSearchParams;
  /** Fields of a JSON or multipart body. */
  body: Record<string, string>;
}

interface ApiReply {
  status?: number;
  body: unknown;
}

type Handler = (call: ApiCall, params: string[]) => ApiReply;

interface Route_ {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

export function tokenFor(user: FixtureUser): string {
  return `e2e-token-${user._id}`;
}

const ok = (data: unknown, extra: Record<string, unknown> = {}, status = 200): ApiReply => ({
  status,
  body: { success: true, message: 'success', data, ...extra },
});
const fail = (status: number, message: string): ApiReply => ({
  status,
  body: { success: false, message, errors: message },
});
const pagination = (total: number, limit: number, more = false) => ({
  currentPage: 1,
  limit,
  total,
  numberOfPages: Math.max(1, Math.ceil(total / limit)),
  ...(more ? { nextPage: 2 } : {}),
});

/**
 * A small in-memory stand-in for the Route Posts API, wired through `page.route`. Response shapes
 * follow docs/api-reference.md. Every call is recorded in `calls`; any API call no handler covers
 * answers `404 route not found` (like the real API) and is listed in `unhandled`, which the shared
 * test fixture asserts is empty. Every other off-origin request (Google Fonts, …) is aborted, and
 * fixture image URLs (IMAGE_HOST) get a 1×1 PNG and the Material Icons font is served from
 * e2e/fixtures/fonts, so a run never touches the network.
 */
export class MockApi {
  readonly calls: ApiCall[] = [];
  readonly unhandled: string[] = [];

  posts: FixturePost[] = initialPosts();
  /** Posts after the first page, served through cursor mode (see `GET /posts/feed`). */
  olderPosts: FixturePost[] = [];
  comments = new Map<string, FixtureComment[]>([[COMMENT_ON_OMAR.post, [{ ...COMMENT_ON_OMAR }]]]);
  replies = new Map<string, FixtureComment[]>();
  notifications: FixtureNotification[];
  /** Per-test copies: handlers mutate them (follow), and fixtures are shared module state. */
  private readonly users = ALL_USERS.map((u) => structuredClone(u));
  private signedInId: string | null;
  private nextId = 1;
  private readonly routes: Route_[] = [];

  constructor(
    private readonly origin: string,
    signedInAs: FixtureUser | null,
  ) {
    this.signedInId = signedInAs?._id ?? null;
    this.notifications = initialNotifications(signedInAs ?? LAYLA);
    this.registerDefaults();
  }

  async install(page: Page): Promise<void> {
    await page.route('**/*', (route) => this.dispatch(route));
  }

  /** Overrides one endpoint (checked before the defaults), e.g. to force an error response. */
  on(method: string, path: string, handler: Handler): void {
    this.routes.unshift({ method, pattern: toPattern(path), handler });
  }

  callsTo(method: string, path: string): ApiCall[] {
    const pattern = toPattern(path);
    return this.calls.filter((call) => call.method === method && pattern.test(call.path));
  }

  /** Resolves with the next matching API request (start waiting before triggering it). */
  waitForCall(page: Page, method: string, path: string): Promise<Request> {
    const pattern = toPattern(path);
    return page.waitForRequest((req) => {
      const url = new URL(req.url());
      return (
        req.url().startsWith(API_BASE_URL) && req.method() === method && pattern.test(url.pathname)
      );
    });
  }

  private async dispatch(route: Route): Promise<void> {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(this.origin)) {
      return route.continue();
    }
    if (url.startsWith(IMAGE_HOST)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL_PNG });
    }
    if (url.startsWith(`https://fonts.gstatic.com${MATERIAL_ICONS_PATH}`)) {
      return route.fulfill({ status: 200, contentType: 'font/woff2', body: MATERIAL_ICONS_WOFF2 });
    }
    if (!url.startsWith(API_BASE_URL)) {
      return route.abort('blockedbyclient');
    }
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: corsHeaders() });
    }

    const parsed = new URL(url);
    const call: ApiCall = {
      method: request.method(),
      path: parsed.pathname,
      query: parsed.searchParams,
      body: parseBody(request),
    };
    this.calls.push(call);
    this.authorize(request);

    let reply: ApiReply | undefined;
    for (const candidate of this.routes) {
      const match = candidate.method === call.method ? candidate.pattern.exec(call.path) : null;
      if (match) {
        reply = candidate.handler(call, match.slice(1));
        break;
      }
    }
    if (!reply) {
      this.unhandled.push(`${call.method} ${call.path}`);
      reply = fail(404, 'route not found');
    }
    await route.fulfill({
      status: reply.status ?? 200,
      contentType: 'application/json',
      headers: corsHeaders(),
      body: JSON.stringify(reply.body),
    });
  }

  /** Mirrors the real API: the bearer token decides who "me" is. */
  private authorize(request: Request): void {
    const header = request.headers()['authorization'];
    const user = this.users.find((u) => header === `Bearer ${tokenFor(u)}`);
    if (user) {
      this.signedInId = user._id;
    }
  }

  private me(): FixtureUser {
    return this.user(this.signedInId ?? LAYLA._id)!;
  }

  private user(id: string): FixtureUser | undefined {
    return this.users.find((u) => u._id === id);
  }

  private id(): string {
    return `6b9${String(this.nextId++).padStart(21, '0')}`;
  }

  private findPost(id: string): FixturePost | undefined {
    return [...this.posts, ...this.olderPosts].find((p) => p.id === id);
  }

  private profileOf(user: FixtureUser) {
    return {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      photo: user.photo,
      cover: '',
      followers: user.followers,
      following: user.following,
      createdAt: user.createdAt,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      bookmarksCount: this.posts.filter((p) => p.bookmarked).length,
      id: user._id,
    };
  }

  private registerDefaults(): void {
    const add = (method: string, path: string, handler: Handler) =>
      this.routes.push({ method, pattern: toPattern(path), handler });

    // --- Auth ---------------------------------------------------------------------------------
    add('POST', '/users/signin', ({ body }) => {
      const user =
        body['login'] === DEMO_CREDENTIALS.login && body['password'] === DEMO_CREDENTIALS.password
          ? DEMO
          : [LAYLA.username, LAYLA.email].includes(body['login']) &&
              body['password'] === LAYLA_PASSWORD
            ? LAYLA
            : null;
      if (!user) {
        return fail(400, 'incorrect email or password');
      }
      this.signedInId = user._id;
      return {
        body: {
          success: true,
          message: 'signed in successfully',
          data: {
            token: tokenFor(user),
            tokenType: 'Bearer',
            expiresIn: '7d',
            user: sessionUser(user),
          },
        },
      };
    });
    add('PATCH', '/users/change-password', ({ body }) =>
      body['password'] === LAYLA_PASSWORD
        ? {
            body: {
              success: true,
              message: 'password changed successfully',
              data: { token: tokenFor(this.me()), tokenType: 'Bearer', expiresIn: '7d' },
            },
          }
        : fail(400, 'incorrect email or password'),
    );

    // --- Users --------------------------------------------------------------------------------
    add('GET', '/users/profile-data', () =>
      ok({ user: { ...this.profileOf(this.me()), bookmarks: [] } }),
    );
    add('GET', '/users/suggestions', () => {
      const suggestions = this.users
        .filter((u) => u._id !== this.me()._id)
        .map((u) => ({
          _id: u._id,
          name: u.name,
          username: u.username,
          photo: u.photo,
          mutualFollowersCount: 0,
          followersCount: u.followers.length,
        }));
      return ok({ suggestions }, { meta: { pagination: pagination(suggestions.length, 10) } });
    });
    add('GET', '/users/bookmarks', () => {
      const bookmarks = this.posts.filter((p) => p.bookmarked);
      return ok({ bookmarks }, { meta: { pagination: pagination(bookmarks.length, 10) } });
    });
    add('GET', '/users/:id/profile', (_call, [id]) => {
      const user = this.user(id);
      return user
        ? ok({ isFollowing: this.me().following.includes(id), user: this.profileOf(user) })
        : fail(404, 'user not found');
    });
    add('GET', '/users/:id/posts', (_call, [id]) => {
      const posts = this.posts.filter((p) => p.user._id === id);
      return ok(
        { posts },
        {
          meta: {
            pagination: { currentPage: 1, numberOfPages: 1, limit: 40, total: posts.length },
          },
        },
      );
    });
    add('PUT', '/users/:id/follow', (_call, [id]) => {
      const me = this.me();
      const following = !me.following.includes(id);
      me.following = following ? [...me.following, id] : me.following.filter((f) => f !== id);
      const target = this.user(id);
      return ok({
        following,
        followersCount: (target?.followers.length ?? 0) + (following ? 1 : 0),
      });
    });

    // --- Posts --------------------------------------------------------------------------------
    add('GET', '/posts/feed', ({ query }) => {
      const cursor = query.get('cursor');
      if (cursor) {
        const posts = this.olderPosts.filter((p) => p.id !== cursor);
        return ok(
          { posts },
          { meta: { feedMode: 'cursor', cursor: { limit: 10, hasMore: false, nextCursor: null } } },
        );
      }
      const only = query.get('only');
      const me = this.me();
      const posts = this.posts.filter((p) =>
        only === 'me'
          ? p.user._id === me._id
          : only === 'following'
            ? p.user._id === me._id || me.following.includes(p.user._id)
            : true,
      );
      return ok(
        { posts },
        {
          meta: {
            feedMode: 'page',
            pagination: pagination(posts.length, 10, this.olderPosts.length > 0),
          },
        },
      );
    });
    add('POST', '/posts', ({ body }) => {
      const id = this.id();
      const created = {
        body: body['body'],
        privacy: 'public',
        user: this.me()._id,
        sharedPost: null,
        likes: [],
        _id: id,
        createdAt: NOW,
        likesCount: 0,
        isShare: false,
        id,
      };
      this.posts.unshift({
        ...created,
        user: author(this.me()),
        commentsCount: 0,
        topComment: null,
        sharesCount: 0,
        bookmarked: false,
      });
      return {
        status: 201,
        body: { success: true, message: 'post created successfully', data: { post: created } },
      };
    });
    add('GET', '/posts/:id', (_call, [id]) => {
      const found = this.findPost(id);
      return found ? ok({ post: found }) : fail(404, 'Post Not Found');
    });
    add('PUT', '/posts/:id/like', (_call, [id]) => {
      const found = this.findPost(id);
      if (!found) return fail(404, 'Post Not Found');
      const meId = this.me()._id;
      const liked = !found.likes.includes(meId);
      found.likes = liked ? [...found.likes, meId] : found.likes.filter((l) => l !== meId);
      found.likesCount = found.likes.length;
      const { commentsCount: _c, topComment: _t, sharesCount: _s, bookmarked: _b, ...rest } = found;
      return ok({
        liked,
        likesCount: found.likesCount,
        post: { ...rest, user: authorWithStats(this.me()) },
      });
    });
    add('GET', '/posts/:id/likes', (_call, [id]) => {
      const found = this.findPost(id);
      const likes = (found?.likes ?? [])
        .map((uid) => this.user(uid))
        .filter((u): u is FixtureUser => !!u)
        .map(authorWithStats);
      return ok({ likes }, { meta: { pagination: pagination(likes.length, 10) } });
    });
    add('PUT', '/posts/:id/bookmark', (_call, [id]) => {
      const found = this.findPost(id);
      if (!found) return fail(404, 'Post Not Found');
      found.bookmarked = !found.bookmarked;
      return ok({
        bookmarked: found.bookmarked,
        bookmarksCount: this.posts.filter((p) => p.bookmarked).length,
      });
    });

    // --- Comments -----------------------------------------------------------------------------
    add('GET', '/posts/:id/comments', (_call, [postId]) => {
      const comments = this.comments.get(postId) ?? [];
      return ok(
        { comments },
        {
          meta: {
            pagination: {
              ...pagination(comments.length, 10),
              numberOfPages: comments.length ? 1 : 0,
            },
          },
        },
      );
    });
    add('POST', '/posts/:id/comments', ({ body }, [postId]) => {
      const comment = this.mutationComment(postId, body['content'] ?? '', null);
      this.comments.set(postId, [
        { ...comment, commentCreator: author(this.me()), repliesCount: 0 },
        ...(this.comments.get(postId) ?? []),
      ]);
      return {
        status: 201,
        body: { success: true, message: 'comment created successfully', data: { comment } },
      };
    });
    add('GET', '/posts/:id/comments/:commentId/replies', (_call, [, commentId]) => {
      const replies = this.replies.get(commentId) ?? [];
      return ok(
        { replies },
        {
          meta: {
            pagination: {
              ...pagination(replies.length, 10),
              numberOfPages: replies.length ? 1 : 0,
            },
          },
        },
      );
    });
    add('POST', '/posts/:id/comments/:commentId/replies', ({ body }, [postId, commentId]) => {
      const reply = this.mutationComment(postId, body['content'] ?? '', commentId);
      this.replies.set(commentId, [
        ...(this.replies.get(commentId) ?? []),
        reply as unknown as FixtureComment,
      ]);
      const parent = this.comments.get(postId)?.find((c) => c._id === commentId);
      if (parent) parent.repliesCount += 1;
      return {
        status: 201,
        body: { success: true, message: 'reply created successfully', data: { reply } },
      };
    });

    // --- Notifications ------------------------------------------------------------------------
    add('GET', '/notifications', () =>
      ok(
        { notifications: this.notifications },
        {
          meta: {
            feedMode: 'page',
            pagination: {
              ...pagination(this.notifications.length, 10),
              numberOfPages: this.notifications.length ? 1 : 0,
            },
          },
        },
      ),
    );
    add('GET', '/notifications/unread-count', () =>
      ok({ unreadCount: this.notifications.filter((n) => !n.isRead).length }),
    );
    add('PATCH', '/notifications/read-all', () => {
      const modifiedCount = this.notifications.filter((n) => !n.isRead).length;
      this.notifications = this.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? NOW,
      }));
      return ok({ modifiedCount });
    });
    add('PATCH', '/notifications/:id/read', (_call, [id]) => {
      const found = this.notifications.find((n) => n._id === id);
      if (!found) return fail(404, 'Notification Not Found');
      Object.assign(found, { isRead: true, readAt: found.readAt ?? NOW });
      return ok({ notification: found });
    });
  }

  /** Mutation shape (create comment/reply responses, replies list). */
  private mutationComment(postId: string, content: string, parentComment: string | null) {
    const id = this.id();
    return {
      _id: id,
      content,
      commentCreator: authorWithStats(this.me()),
      post: postId,
      parentComment,
      likes: [] as string[],
      createdAt: NOW,
      likesCount: 0,
      isReply: parentComment !== null,
      id,
    };
  }
}

/** '/posts/:id/likes' → /^\/posts\/([^/]+)\/likes$/ */
function toPattern(path: string): RegExp {
  return new RegExp(`^${path.replace(/:[a-zA-Z]+/g, '([^/]+)')}$`);
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}

function parseBody(request: Request): Record<string, string> {
  const raw = request.postData();
  if (!raw) return {};
  const contentType = request.headers()['content-type'] ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(raw) as Record<string, string>;
  }
  // multipart/form-data: text fields only (files are irrelevant to the fake).
  const fields: Record<string, string> = {};
  for (const match of raw.matchAll(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)) {
    fields[match[1]] = match[2];
  }
  return fields;
}
