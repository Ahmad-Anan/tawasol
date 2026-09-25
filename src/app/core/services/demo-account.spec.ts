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

describe('DemoAccountService', () => {
  const user = signal<AuthUser | null>(null);
  let resolved: AuthUser | null = null;

  beforeEach(() => {
    user.set(null);
    resolved = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { user, whenUserResolved: () => Promise.resolve(resolved) },
        },
      ],
    });
  });

  const service = (): DemoAccountService => TestBed.inject(DemoAccountService);

  it('recognises the demo account by its user _id', () => {
    user.set(makeUser({ _id: environment.demoUserId }));
    expect(service().isDemo()).toBe(true);
  });

  it('is false for any other account, even one with the demo username', () => {
    user.set(makeUser({ _id: 'another-id', username: environment.demoLogin }));
    expect(service().isDemo()).toBe(false);
  });

  it('is false when signed out', () => {
    expect(service().isDemo()).toBe(false);
  });

  it('follows sign-in and sign-out reactively', () => {
    const demo = service();
    user.set(makeUser({ _id: environment.demoUserId }));
    expect(demo.isDemo()).toBe(true);
    user.set(null);
    expect(demo.isDemo()).toBe(false);
  });

  it('resolveIsDemo() uses the user once it has loaded', async () => {
    resolved = makeUser({ _id: environment.demoUserId });
    expect(await service().resolveIsDemo()).toBe(true);
    resolved = makeUser({ _id: 'another-id' });
    expect(await service().resolveIsDemo()).toBe(false);
  });
});
