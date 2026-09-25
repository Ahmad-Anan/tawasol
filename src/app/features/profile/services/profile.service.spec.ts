import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/constants/api';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { FollowService } from '../../../core/services/follow';
import { ProfileService } from './profile.service';

function profileResponse(id: string) {
  return {
    success: true,
    message: 'ok',
    data: { user: { _id: id, name: `User ${id}` }, isFollowing: false },
  };
}

function postsResponse() {
  return { success: true, message: 'ok', data: { posts: [] }, meta: { pagination: { total: 0 } } };
}

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => true, user: () => ({ _id: 'me' }), token: () => null },
        },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('ignores a slower response for a profile the user already navigated away from', () => {
    service.load('a');
    const staleProfile = httpMock.expectOne(`${API_BASE_URL}/users/a/profile`);
    const stalePosts = httpMock.expectOne(`${API_BASE_URL}/users/a/posts`);

    service.load('b');
    expect(staleProfile.cancelled).toBe(true);
    expect(stalePosts.cancelled).toBe(true);

    httpMock.expectOne(`${API_BASE_URL}/users/b/profile`).flush(profileResponse('b'));
    httpMock.expectOne(`${API_BASE_URL}/users/b/posts`).flush(postsResponse());

    expect(service.profile()?._id).toBe('b');
    expect(service.isLoading()).toBe(false);
    expect(service.loadError()).toBe(false);
  });

  it('retries the last requested profile after a failure', () => {
    service.load('a');
    httpMock
      .expectOne(`${API_BASE_URL}/users/a/profile`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(`${API_BASE_URL}/users/a/posts`);
    expect(service.loadError()).toBe(true);

    service.retryLoad();
    httpMock.expectOne(`${API_BASE_URL}/users/a/profile`).flush(profileResponse('a'));
    httpMock.expectOne(`${API_BASE_URL}/users/a/posts`).flush(postsResponse());

    expect(service.profile()?._id).toBe('a');
    expect(service.loadError()).toBe(false);
  });
});

describe('ProfileService on the demo account', () => {
  it('never uploads a new profile photo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            user: () => ({ _id: environment.demoUserId }),
            token: () => null,
          },
        },
      ],
    });
    const service = TestBed.inject(ProfileService);
    const httpMock = TestBed.inject(HttpTestingController);

    await service.uploadPhoto(new File(['x'], 'a.png', { type: 'image/png' }));

    httpMock.expectNone(`${API_BASE_URL}/users/upload-photo`);
    httpMock.verify();
  });
});

describe('ProfileService keeps counts in sync with follows', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let follow: FollowService;

  function loadProfile(
    id: string,
    counts: { followersCount: number; followingCount: number },
    isFollowing = false,
  ) {
    service.load(id);
    const own = id === 'me';
    httpMock
      .expectOne(own ? `${API_BASE_URL}/users/profile-data` : `${API_BASE_URL}/users/${id}/profile`)
      .flush({
        success: true,
        message: 'ok',
        data: { user: { _id: id, name: `User ${id}`, ...counts }, isFollowing },
      });
    httpMock.expectOne(`${API_BASE_URL}/users/${id}/posts`).flush(postsResponse());
    if (own) {
      httpMock
        .expectOne((req) => req.url === `${API_BASE_URL}/users/bookmarks`)
        .flush({
          success: true,
          message: 'ok',
          data: { bookmarks: [] },
          meta: { pagination: { total: 0 } },
        });
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => true, user: () => ({ _id: 'me' }), token: () => null },
        },
      ],
    });
    service = TestBed.inject(ProfileService);
    follow = TestBed.inject(FollowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("seeds the shared follow state from the loaded profile's isFollowing", () => {
    loadProfile('other', { followersCount: 3, followingCount: 0 }, true);
    expect(service.isFollowing()).toBe(true);
    expect(follow.isFollowing('other')).toBe(true);
  });

  it("updates the viewed profile's follower count optimistically, then to the server's total", async () => {
    loadProfile('other', { followersCount: 3, followingCount: 0 });

    const done = service.toggleFollow();
    expect(service.profile()?.followersCount).toBe(4);

    httpMock
      .expectOne(`${API_BASE_URL}/users/other/follow`)
      .flush({ success: true, message: 'success', data: { following: true, followersCount: 10 } });
    await done;
    expect(service.profile()?.followersCount).toBe(10);
  });

  it('rolls the follower count back when the request fails', async () => {
    loadProfile('other', { followersCount: 3, followingCount: 0 });

    const done = service.toggleFollow();
    httpMock
      .expectOne(`${API_BASE_URL}/users/other/follow`)
      .flush({}, { status: 500, statusText: 'Error' });
    await done;

    expect(service.profile()?.followersCount).toBe(3);
    expect(service.isFollowing()).toBe(false);
    expect(service.followError()).toBe('follow');
  });

  it("updates the signed-in user's own following count when they follow someone elsewhere", async () => {
    loadProfile('me', { followersCount: 0, followingCount: 2 });

    const done = follow.follow('someone-in-suggestions');
    expect(service.profile()?.followingCount).toBe(3);
    httpMock
      .expectOne(`${API_BASE_URL}/users/someone-in-suggestions/follow`)
      .flush({ success: true, message: 'success', data: { following: true, followersCount: 50 } });
    await done;

    expect(service.profile()?.followingCount).toBe(3);
    expect(service.profile()?.followersCount).toBe(0); // someone else's count never lands here
  });
});
