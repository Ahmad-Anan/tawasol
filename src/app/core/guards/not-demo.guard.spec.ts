import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { notDemoGuard } from './not-demo.guard';

@Component({ template: '' })
class Stub {}

describe('notDemoGuard', () => {
  function setup(whenUserResolved: () => Promise<{ _id: string } | null>): Router {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'change-password', component: Stub, canActivate: [notDemoGuard] },
          { path: 'feed', component: Stub },
        ]),
        {
          provide: AuthService,
          useValue: { user: () => null, isAuthenticated: () => true, whenUserResolved },
        },
      ],
    });
    return TestBed.inject(Router);
  }

  it('sends the demo account from /change-password to /feed', async () => {
    const router = setup(() => Promise.resolve({ _id: environment.demoUserId }));
    await router.navigateByUrl('/change-password');
    expect(router.url).toBe('/feed');
  });

  it('lets any other account through', async () => {
    const router = setup(() => Promise.resolve({ _id: 'another-id' }));
    await router.navigateByUrl('/change-password');
    expect(router.url).toBe('/change-password');
  });

  it('waits for the user to load after a hard reload before deciding', async () => {
    let finishHydration: ((user: { _id: string }) => void) | undefined;
    const router = setup(() => new Promise((resolve) => (finishHydration = resolve)));

    const navigation = router.navigateByUrl('/change-password');
    // The guard is now awaiting the user: the navigation must not have completed.
    await vi.waitFor(() => expect(finishHydration).toBeDefined());
    expect(router.url).not.toBe('/change-password');

    finishHydration!({ _id: environment.demoUserId });
    await navigation;
    expect(router.url).toBe('/feed');
  });
});
