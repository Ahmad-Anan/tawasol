// node --test scripts/demo-cleanup.test.mjs — runs in the demo-cleanup workflow before every cleanup.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isKeptComment, loadConfig, planCommentDeletions, planPostDeletions } from './demo-cleanup.mjs';

const config = loadConfig();
const DEMO = config.demoUserId;
const ANAN = '6a49faf58ebe92c2c0b3278b';
const STRANGER = 'stranger-id';
const showcaseIds = [...config.showcasePosts];
const originalIds = [...config.originalComments];

const post = (id, owner = DEMO) => ({ id, user: { _id: owner, username: 'u' } });
const comment = (_id, author) => ({ _id, commentCreator: { _id: author, username: 'u' } });

test('the allowlist has the 4 showcase posts and their 5 original comments', () => {
  assert.equal(showcaseIds.length, 4);
  assert.equal(originalIds.length, 5);
});

test('never plans to delete a showcase post', () => {
  const plan = planPostDeletions([...showcaseIds.map((id) => post(id)), post('visitor-1')], config);
  assert.deepEqual(plan.map((p) => p.id), ['visitor-1']);
});

test("never plans to delete a post that isn't the demo's own", () => {
  assert.deepEqual(planPostDeletions([post('someone-elses', STRANGER)], config), []);
});

test('never plans to delete an original showcase comment, whoever the API says wrote it', () => {
  const threads = originalIds.map((id) => ({ comment: comment(id, STRANGER), replies: [] }));
  assert.deepEqual(planCommentDeletions(threads, config), []);
});

test("keeps Anan's and the demo's comments and replies, deletes strangers'", () => {
  const threads = [
    {
      comment: comment(originalIds[0], ANAN),
      replies: [comment('r-demo', DEMO), comment('r-anan', ANAN), comment('r-stranger', STRANGER)],
    },
    { comment: comment('c-anan', ANAN), replies: [] },
    { comment: comment('c-stranger', STRANGER), replies: [comment('r-under-stranger', STRANGER)] },
  ];
  assert.deepEqual(
    planCommentDeletions(threads, config).map((c) => c._id),
    ['r-stranger', 'r-under-stranger', 'c-stranger'],
  );
});

test('reads the author from an unpopulated commentCreator id too', () => {
  assert.equal(isKeptComment({ _id: 'x', commentCreator: ANAN }, config), true);
  assert.equal(isKeptComment({ _id: 'x', commentCreator: STRANGER }, config), false);
});
