import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import { AuthService } from '../../../core/services/auth.service';
import type {
  AppNotification,
  MarkAllReadApiResponse,
  MarkNotificationReadApiResponse,
  NotificationsListApiResponse,
  UnreadCountApiResponse,
} from '../notifications.interface';

const NOTIFICATIONS_PAGE_SIZE = 10;

/**
 * Signal-based state for notifications, same shape as BookmarksService (real page-based
 * pagination — see docs/api-reference.md — with a plain `page` signal, not `rxResource`).
 *
 * One deliberate exception to "nothing loads merely by injection": the unread count has to be
 * in the navbar badge from the moment the user is signed in, not only once they open
 * `/notifications` — there's no page to wait for a `start()`-style call from. Instead of firing
 * eagerly and unconditionally in the constructor (which really would be the mistake the
 * feed/profile race condition made), the constructor's `effect()` reacts to
 * `AuthService.isAuthenticated()` — a no-op until a session actually exists, whether that's an
 * explicit signin or AuthService rehydrating a stored token on app boot, and resets to 0 on
 * logout. The full notification *list* stays fully on-demand: `loadNotifications()` only ever
 * runs when NotificationsPage's constructor calls it, same as every other list in this app.
 */
@Service()
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _page = signal(1);
  private readonly _hasMore = signal(false);
  private readonly _hasFetchedList = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _isLoadingMore = signal(false);
  private readonly _loadError = signal(false);
  private readonly _loadMoreError = signal(false);

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly hasUnread = computed(() => this._unreadCount() > 0);
  readonly notifications = this._notifications.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingMore = this._isLoadingMore.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly loadMoreError = this._loadMoreError.asReadonly();

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        void this.refreshUnreadCount();
      } else {
        this._unreadCount.set(0);
      }
    });
  }

  async loadNotifications(): Promise<void> {
    if (this._hasFetchedList() || this._isLoading()) {
      return;
    }
    this._isLoading.set(true);
    this._loadError.set(false);
    try {
      const response = await this.fetchPage(1);
      this._notifications.set(response.data.notifications);
      this._page.set(1);
      this._hasMore.set(response.meta.pagination.nextPage !== undefined);
      this._hasFetchedList.set(true);
      // The list is fetched fresh here, but the badge count was likely set earlier (at
      // sign-in/app-boot) and could be stale by the time the user actually opens this page —
      // e.g. a notification read on another device. Resync it against the server rather than
      // trusting whatever it already was.
      void this.refreshUnreadCount();
    } catch {
      this._loadError.set(true);
    } finally {
      this._isLoading.set(false);
    }
  }

  async loadMoreNotifications(): Promise<void> {
    if (!this._hasMore() || this._isLoading()) {
      return;
    }
    const page = this._loadMoreError() ? this._page() : this._page() + 1;
    this._page.set(page);
    this._isLoadingMore.set(true);
    this._loadMoreError.set(false);
    try {
      const response = await this.fetchPage(page);
      this._notifications.update((existing) => [...existing, ...response.data.notifications]);
      this._hasMore.set(response.meta.pagination.nextPage !== undefined);
    } catch {
      this._loadMoreError.set(true);
    } finally {
      this._isLoadingMore.set(false);
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    const wasUnread = this._notifications().find((n) => n._id === notificationId)?.isRead === false;
    await firstValueFrom(
      this.http.patch<MarkNotificationReadApiResponse>(`${API_BASE_URL}/notifications/${notificationId}/read`, {}),
    );
    this._notifications.update((existing) =>
      existing.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n)),
    );
    if (wasUnread) {
      this._unreadCount.update((count) => Math.max(0, count - 1));
    }
  }

  async markAllAsRead(): Promise<void> {
    await firstValueFrom(this.http.patch<MarkAllReadApiResponse>(`${API_BASE_URL}/notifications/read-all`, {}));
    this._notifications.update((existing) => existing.map((n) => ({ ...n, isRead: true })));
    this._unreadCount.set(0);
  }

  private async refreshUnreadCount(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<UnreadCountApiResponse>(`${API_BASE_URL}/notifications/unread-count`),
      );
      this._unreadCount.set(response.data.unreadCount);
    } catch {
      // A transient failure here shouldn't clear an already-showing badge count — leave it as-is.
    }
  }

  private fetchPage(page: number) {
    const params = new HttpParams().set('page', page).set('limit', NOTIFICATIONS_PAGE_SIZE);
    return firstValueFrom(
      this.http.get<NotificationsListApiResponse>(`${API_BASE_URL}/notifications`, { params }),
    );
  }
}
