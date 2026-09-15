import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, effect, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { NotificationItem } from '../notification-item/notification-item';
import { NotificationsService } from '../services/notifications.service';

@Component({
  selector: 'app-notifications-page',
  imports: [NotificationItem, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.css',
})
export class NotificationsPage {
  protected readonly notificationsService = inject(NotificationsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  constructor() {
    // NotificationsService's full list doesn't fetch merely by being constructed/injected
    // (only the unread count does — see the service's own doc comment). This is the one place
    // that actually wants the list loaded.
    void this.notificationsService.loadNotifications();

    // Same true-infinite-scroll pattern as FeedPage/BookmarksPage.
    effect((onCleanup) => {
      const element = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !element) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.notificationsService.loadMoreNotifications();
        }
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }

  protected markAllAsRead(): void {
    void this.notificationsService.markAllAsRead();
  }
}
