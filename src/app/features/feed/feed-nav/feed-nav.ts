import { Component, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Left-hand navigation sidebar for the feed page — Feed / My Posts / Bookmarks. Desktop-only
 * (see feed-page.html — the navbar already covers this navigation on mobile, so these links
 * aren't duplicated there). "Community" from the reference design has no backing endpoint in
 * this API and was deliberately left out rather than added as a dead placeholder link.
 */
@Component({
  selector: 'app-feed-nav',
  imports: [MatIcon, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './feed-nav.html',
  styleUrl: './feed-nav.css',
})
export class FeedNav {
  protected readonly authService = inject(AuthService);
}
