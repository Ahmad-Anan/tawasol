# API Reference — Route Posts API

Source of truth for confirmed request/response shapes of `https://route-posts.routemisr.com`. Entries are added here only after being verified via Postman — do not write a service against an endpoint that isn't documented here yet; test it in Postman first.

Standard response envelope, per AGENTS.md:

```json
// success
{ "success": true, "message": "string", "data": {}, "meta": {} }

// failure
{ "success": false, "message": "string", "errors": "string | string[]" }
```

`errors` has been observed as both a plain string and an array of strings depending on the endpoint — always type it `string | string[]` and handle both when reading it.

---

## POST /users/signup

Creates a new account.

**Request body**

```json
{
  "name": "string",
  "username": "string",
  "email": "string",
  "dateOfBirth": "string",
  "gender": "string",
  "password": "string",
  "rePassword": "string"
}
```

**Success response**

```json
{
  "success": true,
  "message": "account created",
  "data": {
    "token": "string",
    "tokenType": "Bearer",
    "expiresIn": "7d",
    "user": {
      "_id": "string",
      "name": "string",
      "username": "string",
      "email": "string",
      "photo": "string (full URL)",
      "cover": "string"
    }
  }
}
```

**Failure example**

```json
{
  "success": false,
  "message": "user already exists.",
  "errors": "user already exists."
}
```

---

## POST /users/signin

Authenticates an existing account.

**Request body**

```json
{
  "email": "string",
  "password": "string"
}
```

The backend also accepts `username` or `login` as the key in place of `email` — all three are acceptable identifiers for this request. Treat the field as "email, username, or login" on the client, not strictly an email address.

**Verified (live test, 2026-08-12):** the `login` key has no format restriction — it accepts either an email-shaped or a plain-username-shaped value (`200`, `signed in successfully` for both). `username` is validated server-side as `^[a-z0-9_]{3,30}$` and returns a `400` if the value doesn't match that (e.g. an email address, which contains `.`/`@`), even when a valid `email` is also present in the same body — the API validates every key it receives, not just the one it ends up using. **Send only `login`** (never `email`+`username`+`login` together) when the client doesn't know in advance whether the user typed an email or a username.

**Success response**

Same `data` shape as `/users/signup`'s success response (`token`, `tokenType`, `expiresIn`, `user`).

**Failure example**

```json
{
  "success": false,
  "message": "incorrect email or password",
  "errors": "incorrect email or password"
}
```

---

## Posts endpoints — general notes

Every endpoint below requires `Authorization: Bearer <token>` (the same token `/users/signin`/`/users/signup` return). A missing/invalid token fails the same way on every one of them:

```json
// 401
{ "success": false, "message": "token not provided", "errors": "token not provided" }
```

**Verified (live test, 2026-09-14)** against a disposable test account created via `/users/signup` — all shapes below are copied from real responses (ids/urls trimmed or replaced with `…` for brevity), not assumed from the endpoint names.

### The "post" object has two different shapes depending on the endpoint

This is the single most important gotcha in this section — do not write one shared "Post" type and assume every endpoint fills it in fully.

**Full ("list/detail") shape** — returned by `GET /posts/feed`, `GET /posts`, `GET /posts/:id`, and (fully populated, oddly enough) `POST /posts/:id/share`:

```json
{
  "_id": "6aa710938ebe92c2c0b327d4",
  "body": "string (absent entirely on an image-only post)",
  "image": "string, full URL (absent entirely on a text-only post)",
  "privacy": "public",
  "user": {
    "_id": "6a8dbdc78ebe92c2c06ce555",
    "name": "Ahmed",
    "username": "ahmed1235",
    "photo": "string, full URL — defaults to a shared placeholder for users with no uploaded photo"
  },
  "sharedPost": null,
  "likes": ["6a958c0c8ebe92c2c08623d6"],
  "createdAt": "2026-09-13T21:07:31.950Z",
  "commentsCount": 19,
  "topComment": {
    "_id": "6aa7405a8ebe92c2c0b35e43",
    "content": "GOAT",
    "commentCreator": { "_id": "…", "name": "Mohanad Mohamed", "username": "mohanad179", "photo": "…" },
    "post": "6aa710938ebe92c2c0b327d4",
    "parentComment": null,
    "likes": [],
    "createdAt": "2026-09-14T00:31:22.180Z"
  },
  "sharesCount": 0,
  "likesCount": 1,
  "isShare": false,
  "id": "6aa710938ebe92c2c0b327d4",
  "bookmarked": false
}
```

Notes on this shape:
- `id` duplicates `_id` (Mongoose's virtual `id` getter) — either is safe to use; the client uses `id` as the `@for` track key.
- `likes` is an array of liker **user ids**, not populated user objects. There's no `likedByMe` field — the client derives it by checking whether the signed-in user's `_id` is in `likes`.
- When `isShare` is `true`, `sharedPost` is the full original post (same shape, one level deep — it was never observed to itself have a populated `sharedPost`, i.e. no nested-share-of-a-share chains in testing). If the original post was later deleted, `sharedPost` presumably becomes `null` while `isShare` stays `true` — not verified live (would need a share whose original gets deleted mid-test), so the client should treat "`isShare` true but `sharedPost` null" as a real, renderable state ("original post no longer available"), not an error.
- A **nested** `sharedPost` object (and `topComment.commentCreator`) never carries `bookmarked` — only the outermost post in a response does. Model `bookmarked` as optional (`bookmarked?: boolean`), not required, so both cases type-check.
- `user` inside a post fetched via `GET /posts/feed` / `GET /posts` / `GET /posts/:id` only has `_id`/`name`/`username`/`photo`. The `user` object returned inside a **like-toggle** response (below) additionally has `followersCount`/`followingCount`/`bookmarksCount` — those three are the *user's* profile stats, not per-post stats; they showed up there incidentally because that endpoint happens to populate the user more fully, not because they belong on every post's author.

**Slim ("mutation") shape** — returned by `POST /posts` (create) and `PUT /posts/:id` (edit) **only**:

```json
{
  "body": "Hello from Tawasol feed testing (text-only post)",
  "privacy": "public",
  "user": "6aa79ce38ebe92c2c0b37ee6",
  "sharedPost": null,
  "likes": [],
  "_id": "6aa79d068ebe92c2c0b37f07",
  "createdAt": "2026-09-14T07:06:46.810Z",
  "likesCount": 0,
  "isShare": false,
  "id": "6aa79d068ebe92c2c0b37f07"
}
```

Differences from the full shape, all **confirmed by live test, not assumed**: `user` is a bare id **string**, not a populated object — the API does not re-fetch/populate the author on create/edit. `commentsCount`, `topComment`, `sharesCount`, and `bookmarked` are **absent** (not `null` — the keys don't exist). A freshly created/edited post therefore cannot be rendered as a full post card from this response alone; the client fills in the missing author fields from the signed-in user (already held in `AuthService.user()`, whose shape happens to match `PostAuthor`) and defaults the missing counters to `0`/`null`/`false` — see `PostsService` for exactly where this happens.

### GET /posts/feed

The main, personalized feed. Query params (all optional): `only` (`following` | `me` | `all`), `hasImage` (`true`/`false`), plus either page-based (`page`, `limit`) or cursor-based (`cursor`, `limit`) pagination — **the two pagination modes are mutually exclusive and selected by whether `cursor` is present in the query string**, not by a separate mode flag.

- **No `only` param** behaves like `only=following` **including the signed-in user's own posts** (verified: a fresh account with 0 posts and 0 follows got `posts: []`; the same account, after creating posts of its own, got those same posts back with no `only` param and also with `only=following` explicitly — so "following" already includes "me", there's no need to separately merge the two on the client).
- `only` rejects anything else with a `400`: `{"success":false,"message":"\"only\" must be one of [following, me, all]", ...}` — validate/restrict the value client-side to those three before sending it.

**Page mode** (default — no `cursor` in the request):

```json
{
  "success": true,
  "message": "success",
  "data": { "posts": [ /* full-shape posts, newest first */ ] },
  "meta": {
    "feedMode": "page",
    "pagination": { "currentPage": 1, "limit": 20, "total": 3, "numberOfPages": 1 }
  }
}
```

`pagination.nextPage` is only present as a key when another page exists (e.g. `"nextPage": 2`) — its absence, not a `null` value, means "no more pages".

**Cursor mode** (add `?cursor=<id of the last post you already have>`):

```json
{
  "success": true,
  "message": "success",
  "data": { "posts": [ /* full-shape posts strictly older than the cursor post, newest-first */ ] },
  "meta": {
    "feedMode": "cursor",
    "cursor": { "limit": 2, "hasMore": true, "nextCursor": "6aa6bf808ebe92c2c0b2d961" }
  }
}
```

`nextCursor` is simply the `id`/`_id` of the last post in the page just returned — pass it as the next request's `cursor` to keep paging. When `hasMore` is `false`, `nextCursor` is `null`. The client (`PostsService`) uses cursor mode for infinite scroll, since it doesn't skip/duplicate posts if new ones are created while the user is scrolling (a fixed page number would).

### GET /posts

All posts (not personalized/filtered by follows). Same full post shape, page-based pagination only (no `only`, `hasImage`, or `cursor` support observed/documented — don't send them). Response shape:

```json
{
  "success": true,
  "message": "success",
  "data": { "posts": [ /* full-shape posts */ ] },
  "meta": { "pagination": { "currentPage": 1, "limit": 3, "numberOfPages": 2135, "nextPage": 2, "total": 6403 } }
}
```

Note there's no `feedMode` key here (that's a `/posts/feed`-only field) — otherwise the `pagination` object is identical in shape to the feed's page mode.

### POST /posts

Multipart form-data, not JSON: `body` (text, optional) and/or `image` (file, optional) — a post needs at least one of the two in practice, though the API's own minimum-content validation wasn't independently tested (the client enforces "at least one of body/image" itself before submitting either way). `privacy` was not sent in testing and defaulted to `"public"` server-side.

**Success (`201`)** — see the slim shape above. `message`: `"post created successfully"`.

### GET /posts/:id

Full shape, single post, wrapped as `{ "success": true, "message": "success", "data": { "post": { …full shape… } } }`. `404` for an unknown id: `{"success":false,"message":"Post Not Found","errors":"Post Not Found"}`.

### PUT /posts/:id

Same multipart body as create (`body`/`image`). Response: slim shape (see above), wrapped as `data.post`, `message`: `"post updated successfully"`.

### DELETE /posts/:id

No body. Success: `{"success":true,"message":"post deleted successfully","data":{"post":{ …slim shape… }}}`. **Verified:** deleting a post you don't own returns the same `404 Post Not Found` as an unknown id — the API scopes the delete query by owner, so there's no separate `403` to special-case; a `404` on delete just means "not deletable by you", indistinguishable from "doesn't exist".

### PUT /posts/:id/like

Toggles like for the signed-in user (no body). Response:

```json
{
  "success": true,
  "message": "success",
  "data": {
    "liked": true,
    "likesCount": 1,
    "post": { /* full shape MINUS commentsCount/topComment/sharesCount/bookmarked, PLUS a more fully-populated `user` (followersCount/followingCount/bookmarksCount added) */ }
  }
}
```

The client only reads `liked`/`likesCount` from this (and patches just those two fields onto the already-held full post) — the nested `post.user`'s extra stats and the missing counters make it unsafe to use `data.post` as a full replacement for the locally-held post.

### GET /posts/:id/likes

Paginated list of likers (page-based). Response:

```json
{
  "success": true,
  "message": "success",
  "data": {
    "likes": [
      { "_id": "…", "name": "…", "username": "…", "photo": "…", "followersCount": 0, "followingCount": 0, "bookmarksCount": 0, "id": "…" }
    ]
  },
  "meta": { "pagination": { "currentPage": 1, "limit": 10, "total": 1, "numberOfPages": 1 } }
}
```

Not consumed by this pass of the feature (no "who liked this" UI yet) — documented for when that's built.

### PUT /posts/:id/bookmark

Toggles bookmark for the signed-in user (no body). Response:

```json
{ "success": true, "message": "success", "data": { "bookmarked": true, "bookmarksCount": 1 } }
```

**Important:** `bookmarksCount` here is the **signed-in user's total number of bookmarked posts across the whole app**, not a per-post "how many people bookmarked this" counter (verified: it read `1` right after this test account's very first-ever bookmark action, on an account with dozens of posts in the DB to bookmark — it's counting the user's bookmarks, not this post's). There is no per-post bookmark counter anywhere in the API (unlike `likesCount`/`sharesCount`/`commentsCount`, which are per-post). The client only reads `bookmarked` and stores it as the flag on the local post; `bookmarksCount` isn't used by `PostsService`.

### POST /posts/:id/share

No body needed. Creates a new post with `isShare: true`. Response (`201`):

```json
{
  "success": true,
  "message": "post shared successfully",
  "data": {
    "post": {
      "_id": "6aa79d278ebe92c2c0b37f41",
      "privacy": "public",
      "user": { "_id": "…", "name": "…", "username": "…", "photo": "…", "followersCount": 0, "followingCount": 0, "bookmarksCount": 0, "id": "…" },
      "sharedPost": { /* full shape, minus `bookmarked` */ },
      "likes": [],
      "createdAt": "2026-09-14T07:07:19.378Z",
      "commentsCount": 0,
      "topComment": null,
      "sharesCount": 0,
      "likesCount": 0,
      "isShare": true,
      "id": "6aa79d278ebe92c2c0b37f41"
    }
  }
}
```

Unlike create/edit, this response's `user` **is** populated — so, unusually, `POST /posts/:id/share`'s result is safe to prepend to the feed as-is (as a `Post`, with `bookmarked` defaulted to `false` client-side since the key is absent).

---

## Users / profile endpoints — general notes

Every endpoint below requires `Authorization: Bearer <token>`, same as the posts endpoints, and fails the same way (`401`, `"token not provided"`) when it's missing — an invalid/malformed token instead gets `{"success":false,"message":"jwt malformed","errors":"jwt malformed"}`.

**Verified (live test, 2026-09-15)** against two disposable test accounts (`ptesta…`/`ptestb…`) created via `/users/signup` — all shapes below are copied from real responses, not assumed from the endpoint names.

### GET /users/profile-data

The signed-in user's own profile — no `:id` needed, the token alone identifies the account. Response:

```json
{
  "success": true,
  "message": "success",
  "data": {
    "user": {
      "_id": "6aa900228ebe92c2c0b538bc",
      "name": "Profile Tester A",
      "username": "ptesta1789460512",
      "email": "ptesta1789460512@example.com",
      "dateOfBirth": "1995-01-01T00:00:00.000Z",
      "gender": "male",
      "photo": "string, full URL — defaults to a shared placeholder for users with no uploaded photo",
      "cover": "",
      "bookmarks": [],
      "followers": [],
      "following": ["6aa900288ebe92c2c0b538c0"],
      "createdAt": "2026-09-15T08:21:54.975Z",
      "followersCount": 0,
      "followingCount": 1,
      "bookmarksCount": 0,
      "id": "6aa900228ebe92c2c0b538bc"
    }
  }
}
```

Notes:
- No `bio` field was observed anywhere in this API, on any account, in any response — there's no endpoint to set one either. Modeled as optional (`bio?: string`) in case the backend adds it later; the client simply doesn't render a bio row when it's absent, rather than treating it as an error.
- No `postsCount` field — the client gets a user's post count from `GET /users/:id/posts`'s `meta.pagination.total` instead (see below).
- `following`/`followers` here are arrays of bare id **strings** — contrast with `GET /users/:id/profile` below, where the same-named arrays on someone else's profile came back as arrays of **populated summary objects**. Neither array is consumed by the client (no followers/following *list* UI in this pass, only the `*Count` numbers), so this inconsistency is documented but not worked around.

### GET /users/:id/profile

Another user's public profile (also works with your own id — see below). Response adds a top-level `isFollowing` and drops the `bookmarks` array (a user's bookmarks are only ever visible via their own `/users/profile-data`, never through someone else's profile — consistent with bookmarks being private):

```json
{
  "success": true,
  "message": "success",
  "data": {
    "isFollowing": true,
    "user": {
      "_id": "6aa900288ebe92c2c0b538c0",
      "name": "Profile Tester B",
      "username": "ptestb1789460519",
      "email": "ptestb1789460519@example.com",
      "dateOfBirth": "1996-02-02T00:00:00.000Z",
      "gender": "female",
      "photo": "string, full URL",
      "cover": "",
      "followers": [
        { "_id": "6aa900228ebe92c2c0b538bc", "name": "Profile Tester A", "photo": "…", "followersCount": 0, "followingCount": 0, "bookmarksCount": 0, "id": "…" }
      ],
      "following": [],
      "createdAt": "2026-09-15T08:22:00.492Z",
      "followersCount": 1,
      "followingCount": 0,
      "bookmarksCount": 0,
      "id": "6aa900288ebe92c2c0b538c0"
    }
  }
}
```

**Verified:** calling this with your *own* id works fine (not a `404` or special-cased) and returns `isFollowing: false` — the client uses this to render its own profile page too, rather than juggling two different fetch paths for "is this me". `404` for an unknown id: `{"success":false,"message":"user not found","errors":"user not found"}`.

### GET /users/:id/posts

A user's own posts (full post shape, same as the feed's). Query params (`page`, `limit`) are **accepted but silently ignored** — verified live: `?limit=1`, `?page=2`, and no params at all all returned the exact same response (`currentPage: 1`, `limit: 40`, every post the user has, up to 40, newest first). There is no working way to page past the first 40 posts through this endpoint. The client therefore does **not** build a "load more" control for this list — it renders whatever comes back and relies on `meta.pagination.total` only for the profile header's post count, not for driving further fetches.

```json
{
  "success": true,
  "message": "success",
  "data": { "posts": [ /* full post shape, see "Posts endpoints" above */ ] },
  "meta": { "pagination": { "currentPage": 1, "numberOfPages": 1, "limit": 40, "total": 3 } }
}
```

An unknown `:id` does **not** `404` here — it returns `200` with an empty `posts` array and `total: 0`, indistinguishable from "this user exists but has no posts." Not a problem in practice: the client always fetches the profile itself first, which does `404` on an unknown id.

### PUT /users/:id/follow

Toggles follow for the signed-in user (no body). `404` for an unknown id (`"user not found"`); `400` for following yourself (`"you can't follow yourself"`). Response:

```json
{ "success": true, "message": "success", "data": { "following": true, "followersCount": 1 } }
```

`followersCount` here is the **target user's** new total follower count (not the caller's) — verified by toggling and cross-checking against the target's own `GET /users/:id/profile` immediately after. The client patches this straight onto the locally-held profile.

### PUT /users/upload-photo

Multipart form-data, field name `photo` (a `400` with a Multer-shaped validation error — `"\"fieldname\" is required,…"` — if the field is missing). Response:

```json
{
  "success": true,
  "message": "photo uploaded successfully",
  "data": {
    "photo": "https://…/linked-posts/1789460669303-….webp",
    "postId": "6aa900bd8ebe92c2c0b53903"
  }
}
```

**Important, verified live:** this endpoint has a side effect beyond updating the profile photo — it also creates a brand-new public post (`body: "updated profile picture."`, the new photo as its `image`), and `postId` is that post's id. The new photo shows up immediately on `GET /users/profile-data`/`GET /users/:id/profile` (`user.photo`) *and* as a new entry in `GET /users/:id/posts` / the main feed. The client updates the locally-held profile's `photo` from this response directly; it does not attempt to synthesize or insert the new post into any already-loaded list (feed or profile) — that post simply appears the next time either list is freshly fetched, same as any other externally-created post.

### GET /users/bookmarks

**Verified (live test, 2026-09-15)** against the same `ptesta…` test account, after bookmarking 7 real posts via `PUT /posts/:id/bookmark`. The signed-in user's own bookmarked posts, full post shape (same as the feed's — see "Posts endpoints" above), each with `bookmarked: true`. Unlike `GET /users/:id/posts`, this endpoint's pagination is **real** — `?page=`/`?limit=` are genuinely respected, verified by paging through all 7 bookmarks 3-at-a-time and getting distinct, non-overlapping pages:

```json
{
  "success": true,
  "message": "success",
  "data": { "bookmarks": [ /* full-shape posts, each bookmarked: true */ ] },
  "meta": { "pagination": { "currentPage": 1, "limit": 3, "total": 7, "numberOfPages": 3, "nextPage": 2 } }
}
```

Notes:
- The list key is `data.bookmarks`, **not** `data.posts` like every other list endpoint in this API — easy to miss if copy-pasting a type from `GET /posts` or `GET /users/:id/posts`.
- `meta.pagination` also carries `prevPage` (present only once `currentPage > 1`, same "absent, not `null`, when it doesn't apply" convention as `nextPage`) — not previously observed on the other page-based endpoints, but plausible there too; added to the shared pagination type as optional rather than asserted.
- **Ordering is by the post's own `createdAt` (newest first), not by when it was bookmarked.** Verified live: un-bookmarking and re-bookmarking the *oldest* of the 7 test posts (making it the most-recently-bookmarked action) left it in last place in the list — its position tracked the post's original creation date, not the bookmark action's recency.
- An empty list is `{"bookmarks": [], "meta": {"pagination": {"currentPage": 1, "limit": 20, "total": 0, "numberOfPages": 1}}}` — `numberOfPages: 1` even with zero results, not `0`.
- Requires the same `Authorization: Bearer <token>` as every other endpoint here; `401 "token not provided"` without it.

---

## Comments endpoints — general notes

Every endpoint below requires `Authorization: Bearer <token>`, same as everywhere else in this API. **Verified (live test, 2026-09-15)** against the `ptesta…` test account, commenting/replying/liking/editing/deleting for real against a post that already had comments from other real accounts (this backend is a shared, live dataset — not seeded/isolated per test account).

A **reply is just a comment with `parentComment` set** — verified live: `PUT /posts/:postId/comments/:commentId` and `PUT /posts/:postId/comments/:commentId/like` both worked identically when `:commentId` was a *reply's* id, returning the exact same `data.comment` shape as for a top-level comment. There's no separate "edit a reply" or "like a reply" endpoint — the client uses the same comment-mutation methods for both, keyed only by id.

### The comment object has two different shapes, same story as posts — but split differently

This is the single biggest gotcha in this section, and it does **not** line up with the posts full/slim split:

**List shape** — returned by `GET /posts/:postId/comments` (top-level comments) **only**:

```json
{
  "_id": "6aa92e588ebe92c2c0b59b85",
  "content": "Edited comment content",
  "image": "string, full URL (absent entirely when there's no image)",
  "commentCreator": { "_id": "…", "name": "…", "username": "…", "photo": "…" },
  "post": "6aa925a98ebe92c2c0b55e0a",
  "parentComment": null,
  "likes": ["6aa900228ebe92c2c0b538bc"],
  "createdAt": "2026-09-15T11:39:04.360Z",
  "repliesCount": 1
}
```

No `likesCount`, `isReply`, or `id` key at all here — derive "liked by me" and the like count from `likes` the same way `PostsService.isLikedBy` already does for posts (`likes.length`, `likes.includes(myId)`), don't expect a ready-made count. `commentCreator` is the slim shape (no followers/following/bookmarks stats).

**Mutation shape** — returned by `POST .../comments` (create), `PUT .../comments/:commentId` (edit), and, unlike posts, **also by `PUT .../comments/:commentId/like`'s nested `comment`** (nested inside `{ liked, likesCount, comment }`, same envelope shape as the posts like-toggle):

```json
{
  "_id": "6aa92e588ebe92c2c0b59b85",
  "content": "Edited comment content",
  "commentCreator": { "_id": "…", "name": "…", "username": "…", "photo": "…", "followersCount": 0, "followingCount": 0, "bookmarksCount": 0, "id": "…" },
  "post": "6aa925a98ebe92c2c0b55e0a",
  "parentComment": null,
  "likes": [],
  "createdAt": "2026-09-15T11:39:04.360Z",
  "likesCount": 0,
  "isReply": false,
  "id": "6aa92e588ebe92c2c0b59b85"
}
```

Here it's the **opposite** of the list shape: `likesCount`/`isReply`/`id` are present, but `repliesCount` is **absent** — a freshly created/edited comment has no known reply count from this response alone (the client defaults it to `0`, matching a brand-new comment always starting with none, the same reasoning `PostsService.toDisplayPost` already uses for a freshly created post's missing counters). `commentCreator` here is the fuller shape (with stats), same incidental over-population as the posts like-toggle's `user`.

**Replies-list shape** — returned by `GET /posts/:postId/comments/:commentId/replies` — is, confusingly, the **mutation shape**, not the list shape used for top-level comments: it has `likesCount`/`isReply`/`id`, no `repliesCount` (replies can't themselves have replies — not verified live, but there's no endpoint that would create one). Don't reuse the top-level "list shape" type for replies.

### GET /posts/:postId/comments

Top-level comments only (`parentComment: null`), full list shape (above), newest first. Page-based pagination is **real** here (confirmed the same way as `GET /users/bookmarks`: `?limit=1` paged through 3 comments one at a time and got a different, non-overlapping comment back on each page) — unlike `GET /users/:id/posts`, this one is safe to drive a genuine "load more" / infinite scroll from.

```json
{
  "success": true,
  "message": "success",
  "data": { "comments": [ /* list-shape comments */ ] },
  "meta": { "pagination": { "currentPage": 1, "limit": 20, "total": 3, "numberOfPages": 1 } }
}
```

An empty result is `numberOfPages: 0`, not `1` (contrast with `GET /users/bookmarks`, which uses `1` for an empty list) — inconsistent between the two endpoints, but harmless for the client either way since "more pages exist" is read from whether `nextPage` is present, never from `numberOfPages` directly.

### POST /posts/:postId/comments

Multipart form-data: `content` and/or `image`, and **the server itself enforces "at least one of the two"** (`400`, `"\"value\" must contain at least one of [content, image]"`) — unlike posts, where that same rule is only enforced client-side. `image`-only (no `content`) was verified to succeed. Mutation shape response (above), wrapped as `data.comment`, `message: "comment created successfully"`. `404 "Post Not Found"` for an unknown `:postId`.

### PUT /posts/:postId/comments/:commentId

Same multipart body as create. Mutation shape response, `data.comment`, `message: "comment updated successfully"`. **Verified:** editing a comment you don't own returns `403 {"message":"you are not allowed to perform this action."}` — unlike posts (which fold "not yours" and "doesn't exist" into the same `404`), comments give a real, distinguishable `403`. An unknown `:commentId` is a separate `404 {"message":"comment Not Found"}`.

### DELETE /posts/:postId/comments/:commentId

No body. Success: `{"success":true,"message":"comment deleted successfully","data":{}}` — `data` is an empty object, not the deleted comment (contrast with `DELETE /posts/:id`, which returns the deleted post). Same `403`/`404` split as edit, verified live: deleting someone else's comment is `403`, an unknown id is `404`.

### PUT /posts/:postId/comments/:commentId/like

Toggles like for the signed-in user (no body), works identically for a reply's id (see above). Response, same envelope as the posts like-toggle:

```json
{ "success": true, "message": "success", "data": { "liked": true, "likesCount": 1, "comment": { /* mutation shape */ } } }
```

The client only reads `liked`/`likesCount` from this (same reasoning as `PostsService.toggleLike`) — the nested `comment.commentCreator`'s extra stats and the missing `repliesCount` make it unsafe to use `data.comment` as a full replacement for a locally-held list-shape comment.

### GET /posts/:postId/comments/:commentId/replies

Replies to one comment (`parentComment` equal to `:commentId`), replies-list shape (= mutation shape, see above), newest first, real page-based pagination (same as top-level comments — not independently re-verified with `?limit=1` paging, but uses the identical `meta.pagination` shape). An empty result: `{"replies": [], "meta": {"pagination": {"currentPage": 1, "limit": 20, "total": 0, "numberOfPages": 0}}}`.

### POST /posts/:postId/comments/:commentId/replies

Same multipart body and validation as creating a top-level comment. Response wrapped as **`data.reply`** (not `data.comment` — the one place this API uses a different key for what's otherwise the exact same object shape), `message: "reply created successfully"`. The created reply has `parentComment` set to `:commentId` and `isReply: true`.
