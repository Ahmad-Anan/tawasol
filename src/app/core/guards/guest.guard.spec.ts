import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthService } from '../services/auth.service';

@Component({ template: '' })
class Stub {}

describe('guestGuard', () => {
  function setup(isAuthenticated: boolean): Router {
    TestBed.configureTestingModule({
      providers: [
        // The real top-level routes (so '/' and '/auth' redirects are exercised), with the
        // guarded feature pages swapped for a stub so no feature component has to render.
        provideRouter([
          ...routes.filter((route) => route.path === '' || route.path === 'auth'),
          { path: 'feed', component: Stub },
        ]),
        { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated, user: () => null, token: () => null } },
      ],
    });
    return TestBed.inject(Router);
  }

  for (const url of ['/', '/auth', '/auth/login', '/auth/register']) {
    it(`sends a signed-in visitor from ${url} to /feed`, async () => {
      const router = setup(true);
      await router.navigateByUrl(url);
      expect(router.url).toBe('/feed');
    });
  }

  it('keeps a signed-out visitor on the login screen', async () => {
    const router = setup(false);
    await router.navigateByUrl('/');
    expect(router.url).toBe('/auth/login');
  });

  it('lets a signed-out visitor open the register screen', async () => {
    const router = setup(false);
    await router.navigateByUrl('/auth/register');
    expect(router.url).toBe('/auth/register');
  });
});
