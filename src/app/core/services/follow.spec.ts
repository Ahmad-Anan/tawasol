import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../constants/api';
import { FollowCountChange, FollowService } from './follow';

const followUrl = (id: string): string => `${API_BASE_URL}/users/${id}/follow`;
const ok = (following: boolean, followersCount: number) => ({
  success: true,
  message: 'success',
  data: { following, followersCount },
});

describe('FollowService', () => {
  let service: FollowService;
  let httpMock: HttpTestingController;
  let changes: FollowCountChange[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FollowService);
    httpMock = TestBed.inject(HttpTestingController);
    changes = [];
    service.countChanges$.subscribe((change) => changes.push(change));
  });

  afterEach(() => httpMock.verify());

  describe('follow', () => {
    it('updates optimistically, before the server answers', () => {
      void service.follow('u1');

      expect(service.isFollowing('u1')).toBe(true);
      expect(service.isPending('u1')).toBe(true);
      expect(changes).toEqual([{ userId: 'u1', followersDelta: 1 }]);

      httpMock.expectOne(followUrl('u1')).flush(ok(true, 8));
    });

    it("settles on the server's answer and reports the new follower count", async () => {
      const done = service.follow('u1');
      httpMock.expectOne(followUrl('u1')).flush(ok(true, 8));
      await done;

      expect(service.isFollowing('u1')).toBe(true);
      expect(service.isPending('u1')).toBe(false);
      expect(changes.at(-1)).toEqual({ userId: 'u1', followersDelta: 0, followersCount: 8 });
    });

    it('sends only one request while one is in flight (double click)', async () => {
      const first = service.follow('u1');
      void service.follow('u1');
      void service.unfollow('u1');

      httpMock.expectOne(followUrl('u1')).flush(ok(true, 8));
      await first;
    });

    it('does nothing when already following', async () => {
      service.seed('u1', true);
      await service.follow('u1');
      httpMock.expectNone(followUrl('u1'));
    });
  });

  describe('unfollow', () => {
    beforeEach(() => service.seed('u1', true));

    it('updates optimistically and settles on the server answer', async () => {
      const done = service.unfollow('u1');
      expect(service.isFollowing('u1')).toBe(false);
      expect(changes[0]).toEqual({ userId: 'u1', followersDelta: -1 });

      httpMock.expectOne(followUrl('u1')).flush(ok(false, 7));
      await done;
      expect(service.isFollowing('u1')).toBe(false);
      expect(changes.at(-1)).toEqual({ userId: 'u1', followersDelta: 0, followersCount: 7 });
    });
  });

  describe('rollback', () => {
    it('restores the previous state and counts when following fails', async () => {
      const done = service.follow('u1');
      httpMock
        .expectOne(followUrl('u1'))
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await done;

      expect(service.isFollowing('u1')).toBe(false);
      expect(service.isPending('u1')).toBe(false);
      expect(service.failure('u1')).toBe('follow');
      expect(changes).toEqual([
        { userId: 'u1', followersDelta: 1 },
        { userId: 'u1', followersDelta: -1 },
      ]);
    });

    it('restores "following" when unfollowing fails', async () => {
      service.seed('u1', true);
      const done = service.unfollow('u1');
      httpMock.expectOne(followUrl('u1')).error(new ProgressEvent('offline'));
      await done;

      expect(service.isFollowing('u1')).toBe(true);
      expect(service.failure('u1')).toBe('unfollow');
    });

    it('clears the failure on the next attempt', async () => {
      const failed = service.follow('u1');
      httpMock.expectOne(followUrl('u1')).flush({}, { status: 500, statusText: 'Server Error' });
      await failed;

      const retry = service.follow('u1');
      expect(service.failure('u1')).toBeNull();
      httpMock.expectOne(followUrl('u1')).flush(ok(true, 1));
      await retry;
    });
  });

  it('trusts the server when the local state was stale (the endpoint is a toggle)', async () => {
    // We believed "not following", but the toggle unfollowed — we actually were following.
    const done = service.follow('u1');
    httpMock.expectOne(followUrl('u1')).flush(ok(false, 4));
    await done;

    expect(service.isFollowing('u1')).toBe(false);
    // +1 applied optimistically; the real change was -1, so correct by -2.
    expect(changes.at(-1)).toEqual({ userId: 'u1', followersDelta: -2, followersCount: 4 });
  });

  it("doesn't let seed() overwrite a follow that is still in flight", () => {
    void service.follow('u1');
    service.seed('u1', false);
    expect(service.isFollowing('u1')).toBe(true);
    httpMock.expectOne(followUrl('u1')).flush(ok(true, 1));
  });
});
