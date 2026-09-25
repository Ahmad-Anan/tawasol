import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Catch-all page for any URL no route matches (the `'**'` route in app.routes.ts). Its server
 * route (app.routes.server.ts) returns a real HTTP 404, so crawlers and link checkers see the
 * page as missing even though the app still renders its own bilingual page for people.
 */
@Component({
  selector: 'app-not-found-page',
  imports: [MatButtonModule, MatIcon, RouterLink, TranslatePipe],
  templateUrl: './not-found-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {
  private readonly authService = inject(AuthService);

  /** Signed-in visitors go back to their feed; everyone else to the login screen. */
  protected readonly homeLink = computed(() => (this.authService.isAuthenticated() ? '/feed' : '/auth/login'));
}
