import { Service, computed, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Whether the signed-in user is the public "Try the demo" account (see
 * environments/environment.ts). Its credentials are public, so the UI protects the account
 * from visitors: no password change, no profile photo change, and no deleting the posts it
 * already had.
 *
 * Identified by the signed-in user's `_id` from the auth state — never by username — so it
 * doesn't matter whether the visitor used the demo button or typed the credentials.
 */
@Service()
export class DemoAccountService {
  private readonly authService = inject(AuthService);

  readonly isDemo = computed(() => this.authService.user()?._id === environment.demoUserId);

  /** Same check, but waits for the user to load after a hard reload (for route guards). */
  async resolveIsDemo(): Promise<boolean> {
    const user = await this.authService.whenUserResolved();
    return user?._id === environment.demoUserId;
  }
}
