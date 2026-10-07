// Daily cleanup of the public demo account (run by .github/workflows/demo-cleanup.yml).
//
// Usage:
//   DEMO_LOGIN=... DEMO_PASSWORD=... node scripts/demo-cleanup.mjs            (deletes)
//   DEMO_LOGIN=... DEMO_PASSWORD=... DRY_RUN=true node scripts/demo-cleanup.mjs  (only logs)
//
// The demo's credentials are public, so visitors post on it. This deletes:
//   - every post on the demo account that isn't one of the showcase posts, and
//   - every comment/reply on a showcase post that wasn't written by an allowed author (Anan or
//     the demo account) and isn't one of the showcase's original comments.
// The allowlist (showcase post ids, original comment ids, allowed authors) is
// scripts/demo-showcase.json. Credentials come from env only — never put them in the repo.
//
// Safety: the decisions are pure functions (planPostDeletions/planCommentDeletions) covered by
// scripts/demo-cleanup.test.mjs, and the delete calls re-check the allowlist themselves. The run
// aborts before deleting anything if the signed-in account isn't the demo account, or if any
// showcase post is missing (something is off; a human should look).

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Mirrors src/app/core/constants/api.ts.
const API_BASE_URL = 'https://route-posts.routemisr.com';
// GET /users/:id/posts ignores paging and returns at most 40 (docs/api-reference.md), so posts
// are deleted in rounds until nothing deletable is left.
const MAX_POST_ROUNDS = 10;
const COMMENTS_PAGE_SIZE = 50;

export function loadConfig(url = new URL('./demo-showcase.json', import.meta.url)) {
  const raw = JSON.parse(readFileSync(url, 'utf8'));
  return {
    demoUserId: raw.demoUserId,
    allowedAuthors: new Set(Object.keys(raw.allowedCommentAuthors)),
    showcasePosts: new Set(Object.keys(raw.showcasePosts)),
    originalComments: new Set(Object.keys(raw.originalComments)),
  };
}

const authorId = (item) => (typeof item.commentCreator === 'object' ? item.commentCreator?._id : item.commentCreator);
const postOwnerId = (post) => (typeof post.user === 'object' ? post.user?._id : post.user);

/** Posts to delete: the demo's own posts that aren't showcase posts. */
export function planPostDeletions(posts, config) {
  return posts.filter((post) => !config.showcasePosts.has(post.id) && postOwnerId(post) === config.demoUserId);
}

/** Whether a comment or reply on a showcase post must stay. */
export function isKeptComment(comment, config) {
  return config.originalComments.has(comment._id) || config.allowedAuthors.has(authorId(comment));
}

/**
 * Comments/replies to delete on one showcase post, replies before their parent (so nothing is
 * left orphaned mid-run). `threads` is `[{ comment, replies }]`.
 */
export function planCommentDeletions(threads, config) {
  const plan = [];
  for (const { comment, replies } of threads) {
    plan.push(...replies.filter((reply) => !isKeptComment(reply, config)));
    if (!isKeptComment(comment, config)) {
      plan.push(comment);
    }
  }
  return plan;
}

function summarize(item) {
  const who = item.user?.username ?? item.commentCreator?.username ?? 'unknown';
  const text = (item.body ?? item.content ?? (item.isShare ? '[share]' : '') ?? '').replace(/\s+/g, ' ').slice(0, 60);
  return `@${who}, ${item.createdAt}, "${text}"`;
}

async function main() {
  const { DEMO_LOGIN, DEMO_PASSWORD } = process.env;
  const dryRun = process.env.DRY_RUN === 'true';
  if (!DEMO_LOGIN || !DEMO_PASSWORD) {
    throw new Error('DEMO_LOGIN and DEMO_PASSWORD must be set (GitHub Actions secrets).');
  }
  const config = loadConfig();

  const signin = await request('POST', '/users/signin', null, { login: DEMO_LOGIN, password: DEMO_PASSWORD });
  const token = signin.data.token;
  if (signin.data.user?._id !== config.demoUserId) {
    throw new Error(`Signed in as ${signin.data.user?._id}, not the demo account — refusing to delete anything.`);
  }
  const api = (method, path) => request(method, path, token);

  console.log(dryRun ? 'DRY RUN — nothing will be deleted.\n' : '');
  const deleted = { posts: [], comments: [] };
  const refused = [];

  // Posts
  for (let round = 1; round <= MAX_POST_ROUNDS; round++) {
    const posts = (await api('GET', `/users/${config.demoUserId}/posts`)).data.posts;
    if (round === 1) {
      const missing = [...config.showcasePosts].filter((id) => !posts.some((post) => post.id === id));
      if (missing.length > 0) {
        throw new Error(`Showcase post(s) missing: ${missing.join(', ')} — refusing to delete anything.`);
      }
    }
    const plan = planPostDeletions(posts, config);
    if (plan.length === 0) {
      break;
    }
    for (const post of plan) {
      if (config.showcasePosts.has(post.id)) {
        throw new Error(`Refusing to delete showcase post ${post.id}.`);
      }
      console.log(`${dryRun ? 'would delete' : 'deleted'} post ${post.id} (${summarize(post)})`);
      if (!dryRun) {
        await api('DELETE', `/posts/${post.id}`);
      }
      deleted.posts.push(post.id);
    }
    if (dryRun) {
      break;
    }
  }

  // Comments and replies on the showcase posts
  for (const postId of config.showcasePosts) {
    const threads = [];
    for (const comment of await getAllPages(api, `/posts/${postId}/comments`, 'comments')) {
      const replies = comment.repliesCount
        ? await getAllPages(api, `/posts/${postId}/comments/${comment._id}/replies`, 'replies')
        : [];
      threads.push({ comment, replies });
    }
    for (const comment of planCommentDeletions(threads, config)) {
      if (isKeptComment(comment, config)) {
        throw new Error(`Refusing to delete kept comment ${comment._id}.`);
      }
      const kind = comment.parentComment ? 'reply' : 'comment';
      if (dryRun) {
        console.log(`would delete ${kind} ${comment._id} on post ${postId} (${summarize(comment)})`);
        deleted.comments.push(comment._id);
        continue;
      }
      try {
        await api('DELETE', `/posts/${postId}/comments/${comment._id}`);
        console.log(`deleted ${kind} ${comment._id} on post ${postId} (${summarize(comment)})`);
        deleted.comments.push(comment._id);
      } catch (error) {
        if (error.status !== 403) {
          throw error;
        }
        // The API only lets a comment's own author delete it (docs/api-reference.md > DELETE
        // /posts/:postId/comments/:commentId) — logged rather than failing the whole run.
        console.log(`::warning::API refused (403) to delete ${kind} ${comment._id} on post ${postId} (${summarize(comment)}): the post owner can't delete other users' comments.`);
        refused.push(comment._id);
      }
    }
  }

  const verb = dryRun ? 'Would delete' : 'Deleted';
  console.log(`\n${verb} ${deleted.posts.length} post(s) and ${deleted.comments.length} comment(s)/reply(ies).`);
  if (refused.length > 0) {
    console.log(`${refused.length} comment(s)/reply(ies) could not be deleted (403 from the API).`);
  }
}

async function getAllPages(api, path, key) {
  const items = [];
  for (let page = 1; ; page++) {
    const response = await api('GET', `${path}?limit=${COMMENTS_PAGE_SIZE}&page=${page}`);
    items.push(...response.data[key]);
    if (response.meta?.pagination?.nextPage === undefined) {
      return items;
    }
  }
}

async function request(method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const response = await fetch(API_BASE_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${json.message ?? ''}`);
    error.status = response.status;
    throw error;
  }
  return json;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exit(1);
  });
}
