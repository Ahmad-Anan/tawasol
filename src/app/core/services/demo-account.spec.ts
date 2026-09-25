import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { AuthUser } from '../../features/auth/auth.interface';
import { AuthService } from './auth.service';
import { DemoAccountService } from './demo-account';

function makeUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    _id: 'someone',
    name: 'Someone',
    username: 'someone',
    email: 'x@example.com',
    photo: '',
    ...overrides,
  } as AuthUser;
}

const demoUser = (): AuthUser => makeUser({ _id: environment.demoUserId });

describe('DemoAccountService', () => {
  const user = signal<AuthUser | null>(null);
  const token = signal<string | null>(null);
  let resolved: AuthUser | null = null;

  beforeEach(() => {
    sessionStorage.clear();
    user.set(null);
    token.set(null);
    resolved = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user,
            isAuthenticated: () => token() !== null,
            whenUserResolved: () => Promise.resolve(resolved),
          },
        },
      ],
    });
  });

  const service = (): DemoAccountService => TestBed.inject(DemoAccountService);
  const signIn = (account: AuthUser): void => {
    token.set('token');
    user.set(account);
    TestBed.tick();
  };

  describe('isDemo', () => {
    it('recognises the demo account by its user _id', () => {
      signIn(demoUser());
      expect(service().isDemo()).toBe(true);
    });

    it('is false for any other account, even one with the demo username', () => {
      signIn(makeUser({ _id: 'another-id', username: environment.demoLogin }));
      expect(service().isDemo()).toBe(false);
    });

    it('is false when signed out', () => {
      expect(service().isDemo()).toBe(false);
    });

    it('follows sign-in and sign-out reactively', () => {
      const demo = service();
      signIn(demoUser());
      expect(demo.isDemo()).toBe(true);
      user.set(null);
      expect(demo.isDemo()).toBe(false);
    });

    it('resolveIsDemo() uses the user once it has loaded', async () => {
      resolved = demoUser();
      expect(await service().resolveIsDemo()).toBe(true);
      resolved = makeUser({ _id: 'another-id' });
      expect(await service().resolveIsDemo()).toBe(false);
    });
  });

  describe('canModifyPost (edit and delete)', () => {
    it('lets a regular account delete any of its posts', () => {
      signIn(makeUser({ _id: 'another-id' }));
      expect(service().canModifyPost('old-post')).toBe(true);
    });

    it("blocks deleting the demo account's pre-existing posts", () => {
      signIn(demoUser());
      expect(service().canModifyPost('old-post')).toBe(false);
    });

    it('allows deleting posts the demo account created this session', () => {
      signIn(demoUser());
      service().recordCreatedPost('new-post');
      expect(service().canModifyPost('new-post')).toBe(true);
      expect(service().canModifyPost('old-post')).toBe(false);
    });

    it('does not record posts created by a regular account', () => {
      signIn(makeUser({ _id: 'another-id' }));
      service().recordCreatedPost('p1');
      expect(sessionStorage.getItem('tawasol-demo-session-posts')).toBeNull();
    });

    it("keeps this session's posts deletable across a reload of the tab", () => {
      signIn(demoUser());
      service().recordCreatedPost('new-post');

      // A reload: a fresh service reading the same sessionStorage.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: AuthService,
            useValue: {
              user,
              isAuthenticated: () => true,
              whenUserResolved: () => Promise.resolve(demoUser()),
            },
          },
        ],
      });
      expect(TestBed.inject(DemoAccountService).canModifyPost('new-post')).toBe(true);
    });

    it('starts a new demo session clean after signing out', () => {
      const demo = service();
      signIn(demoUser());
      demo.recordCreatedPost('new-post');

      token.set(null);
      user.set(null);
      TestBed.tick();
      signIn(demoUser());

      expect(demo.canModifyPost('new-post')).toBe(false);
    });
  });
});
