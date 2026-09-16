import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { NotificationItem } from '../notification-item/notification-item';
import { NotificationsService } from '../services/notifications.service';

type NotificationsTab = 'all' | 'unread';

@Component({
  selector: 'app-notifications-page',
  imports: [
    NotificationItem,
    MatButtonModule,
    MatButtonToggleModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.css',
})
export class NotificationsPage {
  protected readonly notificationsService = inject(NotificationsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  /**
   * Purely a client-side filter over the already-loaded list — no separate API call. Infinite
   * scroll still loads/appends the *unfiltered* list underneath (see notifications-page.html's
   * scrollSentinel), so switching to "Unread" while more pages exist can still trigger more
   * fetching if few of the loaded notifications are unread.
   */
  protected readonly activeTab = signal<NotificationsTab>('all');
  protected readonly filteredNotifications = computed(() =>
    this.activeTab() === 'unread'
      ? this.notificationsService.notifications().filter((n) => !n.isRead)
      : this.notificationsService.notifications(),
  );

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

  protected setActiveTab(tab: NotificationsTab): void {
    this.activeTab.set(tab);
  }
}
