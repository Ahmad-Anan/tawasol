import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language';
import type { AppNotification } from '../notifications.interface';
import { NotificationsService } from '../services/notifications.service';

/**
 * One notification row. Always links to the actor's profile (`/profile/:actorId`) — this app
 * has no single-post detail route to link to (posts are only ever shown inline in a list), so
 * "go to the post" isn't actually buildable; the actor's profile is the closest meaningful,
 * honest destination for every notification type, including a reply (where the notification's
 * own `entity` is the parent comment that was replied to, not the reply itself — see
 * docs/api-reference.md). Clicking always marks it read, whether or not it already was.
 */
@Component({
  selector: 'app-notification-item',
  imports: [NgOptimizedImage, RouterLink, TranslatePipe],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.css',
})
export class NotificationItem {
  private readonly notificationsService = inject(NotificationsService);
  private readonly languageService = inject(LanguageService);

  readonly notification = input.required<AppNotification>();

  /**
   * A reply notification shares `type: "comment_post"` with a top-level-comment notification —
   * only `entityType` ("comment" vs "post") tells them apart (see docs/api-reference.md).
   */
  protected readonly messageKey = computed(() => {
    const notification = this.notification();
    if (notification.type === 'comment_post' && notification.entityType === 'comment') {
      return 'notifications.messages.reply';
    }
    switch (notification.type) {
      case 'like_post':
        return 'notifications.messages.like';
      case 'comment_post':
        return 'notifications.messages.comment';
      case 'follow_user':
        return 'notifications.messages.follow';
      case 'share_post':
        return 'notifications.messages.share';
    }
  });

  protected readonly formattedDate = computed(() => this.formatDate(this.notification().createdAt));

  protected onClick(): void {
    if (!this.notification().isRead) {
      void this.notificationsService.markAsRead(this.notification()._id);
    }
  }

  private formatDate(createdAt: string): string {
    const locale = this.languageService.lang() === 'ar' ? 'ar' : 'en';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(createdAt));
  }
}
