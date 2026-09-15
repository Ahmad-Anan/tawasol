import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { LanguageService } from '../../core/services/language';
import { NotificationsService } from '../../features/notifications/services/notifications.service';

@Component({
  selector: 'app-navbar',
  imports: [NgOptimizedImage, MatBadgeModule, MatIconButton, MatIcon, RouterLink, TranslatePipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly languageService = inject(LanguageService);
  // Injecting this is what starts its unread-count tracking (reacting to auth state) — see
  // the service's own doc comment on why that's the one deliberate exception to "nothing
  // loads merely by injection". Navbar is always rendered, so this happens as early as
  // possible, well before the user ever opens /notifications.
  protected readonly notificationsService = inject(NotificationsService);
}
