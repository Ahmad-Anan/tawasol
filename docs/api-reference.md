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
