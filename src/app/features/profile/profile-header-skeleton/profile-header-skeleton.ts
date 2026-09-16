import { Component } from '@angular/core';

/**
 * Static placeholder shaped like `ProfileHeader`, shown during a profile's first load instead of
 * a bare spinner. `aria-hidden` — ProfilePage wraps this in a `role="status"` region (see
 * profile-page.html) so a screen reader announces "loading" once, not by reading this markup.
 */
@Component({
  selector: 'app-profile-header-skeleton',
  templateUrl: './profile-header-skeleton.html',
  styleUrl: './profile-header-skeleton.css',
  host: { 'aria-hidden': 'true' },
})
export class ProfileHeaderSkeleton {}
