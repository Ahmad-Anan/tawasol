// Users for the mocked Route Posts API. Shapes follow docs/api-reference.md (GET /users/profile-data,
// GET /users/:id/profile, GET /users/suggestions); ids are 24-hex like the real API's.
import { IMAGES } from './images';

export interface FixtureUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  photo: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  createdAt: string;
  following: string[];
  followers: string[];
}

/** A regular (non-demo) account — the default signed-in user. */
export const LAYLA: FixtureUser = {
  _id: '6b1000000000000000000001',
  name: 'Layla Hassan',
  username: 'layla_h',
  email: 'layla@example.com',
  photo: IMAGES.avatar,
  dateOfBirth: '1995-01-01T00:00:00.000Z',
  gender: 'female',
  createdAt: '2026-09-15T08:21:54.975Z',
  following: ['6b1000000000000000000002'],
  followers: [],
};

export const OMAR: FixtureUser = {
  _id: '6b1000000000000000000002',
  name: 'Omar Khaled',
  username: 'omar_k',
  email: 'omar@example.com',
  photo: IMAGES.avatar,
  dateOfBirth: '1993-04-12T00:00:00.000Z',
  gender: 'male',
  createdAt: '2026-08-02T10:00:00.000Z',
  following: [],
  followers: ['6b1000000000000000000001'],
};

export const SARA: FixtureUser = {
  _id: '6b1000000000000000000003',
  name: 'سارة علي',
  username: 'sara_ali',
  email: 'sara@example.com',
  photo: IMAGES.avatar,
  dateOfBirth: '1998-07-20T00:00:00.000Z',
  gender: 'female',
  createdAt: '2026-08-20T10:00:00.000Z',
  following: [],
  followers: [],
};

/** The public "Try the demo" account — `_id` must equal src/environments/environment.ts `demoUserId`. */
export const DEMO: FixtureUser = {
  _id: '6ab61f4f8ebe92c2c0ca67ff',
  name: 'Tawasol Demo',
  username: 'tawasol_demo',
  email: 'demo@example.com',
  photo: IMAGES.avatar,
  dateOfBirth: '1990-01-01T00:00:00.000Z',
  gender: 'male',
  createdAt: '2026-08-01T10:00:00.000Z',
  following: ['6b1000000000000000000002'],
  followers: [],
};

/** Public, intentionally shipped demo credentials (see src/environments/environment.ts). */
export const DEMO_CREDENTIALS = { login: 'tawasol_demo', password: 'Aa123456#' };
/** What the fake backend accepts for LAYLA; anything else is "incorrect email or password". */
export const LAYLA_PASSWORD = 'Layla#2026';

export const ALL_USERS = [LAYLA, OMAR, SARA, DEMO];

/** `user` inside a full-shape post / comment list item: `_id`, `name`, `username`, `photo` only. */
export function author(user: FixtureUser) {
  return { _id: user._id, name: user.name, username: user.username, photo: user.photo };
}

/** `user` with stats, as in like-toggle responses, likers lists and mutation-shape comments. */
export function authorWithStats(user: FixtureUser) {
  return {
    ...author(user),
    followersCount: user.followers.length,
    followingCount: user.following.length,
    bookmarksCount: 0,
    id: user._id,
  };
}

/** Sign-in/sign-up `data.user`. */
export function sessionUser(user: FixtureUser) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    photo: user.photo,
    cover: '',
  };
}
