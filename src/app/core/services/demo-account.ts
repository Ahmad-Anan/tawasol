import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, effect, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const SESSION_POSTS_STORAGE_KEY = 'tawasol-demo-session-posts';

/**
 * Whether the signed-in user is the public "Try the demo" account (see
 * environments/environment.ts). Its credentials are public, so the UI protects the account
 * from visitors: no password change, no profile photo change, and no editing or deleting the
 * posts it already had.
 *
 * Identified by the signed-in user's `_id` from the auth state — never by username — so it
 * doesn't matter whether the visitor used the demo button or typed the credentials.
 */
@Service()
export class DemoAccountService {
  private readonly authService = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly isDemo = computed(() => this.authService.user()?._id === environment.demoUserId);

  /**
   * Posts the demo account created (or shared) during this session — the only ones a visitor
   * may edit or delete, so the demo's showcase content stays intact for the next visitor. Kept in
   * sessionStorage: it survives a reload of the same tab but not a new tab, and it's cleared on
   * sign-out, so each demo session starts clean.
   */
  private readonly sessionPostIds = signal<ReadonlySet<string>>(this.readSessionPostIds());

  constructor() {
    effect(() => {
      if (this.authService.user() === null && !this.authService.isAuthenticated()) {
        this.setSessionPostIds(new Set());
      }
    });
  }

  /** Same check, but waits for the user to load after a hard reload (for route guards). */
  async resolveIsDemo(): Promise<boolean> {
    const user = await this.authService.whenUserResolved();
    return user?._id === environment.demoUserId;
  }

  /** Called when a post is created or shared, so the demo can edit/delete it again this session. */
  recordCreatedPost(postId: string): void {
    if (this.isDemo()) {
      this.setSessionPostIds(new Set([...this.sessionPostIds(), postId]));
    }
  }

  /** Any account may edit or delete its own posts, except the demo account's pre-existing ones. */
  canModifyPost(postId: string): boolean {
    return !this.isDemo() || this.sessionPostIds().has(postId);
  }

  private setSessionPostIds(ids: ReadonlySet<string>): void {
    this.sessionPostIds.set(ids);
    if (!this.isBrowser) {
      return;
    }
    try {
      if (ids.size === 0) {
        sessionStorage.removeItem(SESSION_POSTS_STORAGE_KEY);
      } else {
        sessionStorage.setItem(SESSION_POSTS_STORAGE_KEY, JSON.stringify([...ids]));
      }
    } catch {
      // Storage unavailable (e.g. blocked): the in-memory set still works for this page load.
    }
  }

  private readSessionPostIds(): ReadonlySet<string> {
    if (!this.isBrowser) {
      return new Set();
    }
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(SESSION_POSTS_STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }
}
