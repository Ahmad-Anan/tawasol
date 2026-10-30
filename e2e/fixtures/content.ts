// Posts, comments and notifications for the mocked API. Shapes follow docs/api-reference.md:
// full-shape posts (GET /posts/feed, /posts/:id, /users/:id/posts, /users/bookmarks), list-shape
// comments (GET /posts/:postId/comments) and the shared notification object (GET /notifications).
// Dates are fixed and sit just before NOW, so timestamps render identically on every run.
import { IMAGES } from './images';
import { DEMO, LAYLA, OMAR, SARA, author, type FixtureUser } from './users';

/** The browser clock is frozen here (see e2e/support/test.ts). */
export const NOW = '2026-10-15T12:00:00.000Z';

export interface FixturePost {
  _id: string;
  id: string;
  body?: string;
  image?: string;
  privacy: string;
  user: ReturnType<typeof author>;
  sharedPost: FixturePost | null;
  likes: string[];
  createdAt: string;
  commentsCount: number;
  topComment: FixtureTopComment | null;
  sharesCount: number;
  likesCount: number;
  isShare: boolean;
  bookmarked?: boolean;
}

export interface FixtureTopComment {
  _id: string;
  content: string;
  commentCreator: ReturnType<typeof author>;
  post: string;
  parentComment: string | null;
  likes: string[];
  createdAt: string;
}

export interface FixtureComment extends FixtureTopComment {
  image?: string;
  repliesCount: number;
}

function post(
  fields: Partial<FixturePost> & Pick<FixturePost, '_id' | 'createdAt'> & { by: FixtureUser },
): FixturePost {
  const { by, ...rest } = fields;
  return {
    id: fields._id,
    privacy: 'public',
    user: author(by),
    sharedPost: null,
    likes: [],
    commentsCount: 0,
    topComment: null,
    sharesCount: 0,
    likesCount: 0,
    isShare: false,
    bookmarked: false,
    ...rest,
  };
}

export const COMMENT_ON_OMAR: FixtureComment = {
  _id: '6b3000000000000000000001',
  content: 'Congratulations, well deserved!',
  commentCreator: author(SARA),
  post: '6b2000000000000000000001',
  parentComment: null,
  likes: [],
  createdAt: '2026-10-14T10:05:00.000Z',
  repliesCount: 0,
};

/** Newest first, like the real feed. */
export function initialPosts(): FixturePost[] {
  const { repliesCount: _repliesCount, ...topComment } = COMMENT_ON_OMAR;
  return [
    post({
      _id: '6b2000000000000000000001',
      by: OMAR,
      body: 'Shipping the new release today. Thanks to everyone who tested it!',
      image: IMAGES.postPhoto,
      likes: [SARA._id],
      likesCount: 1,
      commentsCount: 1,
      topComment,
      createdAt: '2026-10-14T09:30:00.000Z',
    }),
    post({
      _id: '6b2000000000000000000002',
      by: LAYLA,
      body: 'My first post on Tawasol.',
      createdAt: '2026-10-13T16:45:00.000Z',
    }),
    post({
      _id: '6b2000000000000000000003',
      by: SARA,
      body: 'صباح الخير، يوم موفق للجميع',
      bookmarked: true,
      createdAt: '2026-10-12T07:15:00.000Z',
    }),
    post({
      _id: '6b2000000000000000000004',
      by: DEMO,
      body: 'Welcome to the Tawasol demo account.',
      createdAt: '2026-10-11T08:00:00.000Z',
    }),
  ];
}

/** Only served through cursor mode (second page) when a test enables more pages. */
export const OLDER_POST: FixturePost = post({
  _id: '6b2000000000000000000009',
  by: OMAR,
  body: 'An older post from last week.',
  createdAt: '2026-10-05T11:00:00.000Z',
});

export interface FixtureNotification {
  _id: string;
  recipient: { _id: string; name: string; photo: string };
  actor: { _id: string; name: string; photo: string };
  type: 'like_post' | 'comment_post' | 'follow_user' | 'share_post';
  entityType: 'post' | 'comment' | 'user';
  entityId: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  entity: Record<string, unknown>;
}

export function initialNotifications(recipient: FixtureUser): FixtureNotification[] {
  const person = (u: FixtureUser) => ({ _id: u._id, name: u.name, photo: u.photo });
  return [
    {
      _id: '6b4000000000000000000001',
      recipient: person(recipient),
      actor: person(OMAR),
      type: 'like_post',
      entityType: 'post',
      entityId: '6b2000000000000000000002',
      isRead: false,
      createdAt: '2026-10-15T09:00:00.000Z',
      // entityType "post": a post-shaped object whose `user` is a bare id string.
      entity: {
        _id: '6b2000000000000000000002',
        body: 'My first post on Tawasol.',
        user: recipient._id,
        commentsCount: 0,
        topComment: null,
        sharesCount: 0,
        likesCount: 1,
        isShare: false,
        id: '6b2000000000000000000002',
      },
    },
    {
      _id: '6b4000000000000000000002',
      recipient: person(recipient),
      actor: person(SARA),
      type: 'follow_user',
      entityType: 'user',
      entityId: SARA._id,
      isRead: true,
      createdAt: '2026-10-14T18:30:00.000Z',
      readAt: '2026-10-14T19:00:00.000Z',
      entity: {
        _id: SARA._id,
        name: SARA.name,
        username: SARA.username,
        photo: SARA.photo,
        followersCount: 0,
        followingCount: 0,
        bookmarksCount: 0,
        id: SARA._id,
      },
    },
  ];
}
