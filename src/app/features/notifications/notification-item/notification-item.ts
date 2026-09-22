import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language';
import type { AppNotification, NotificationCommentEntity } from '../notifications.interface';
import { NotificationsService } from '../services/notifications.service';

/**
 * One notification row. Links to the post it concerns (`/posts/:id`, the permalink page) for
 * `like_post`/`share_post`/a top-level `comment_post` (`entityType: 'post'`, `entity.id` is the
 * post itself) and for a reply (`entityType: 'comment'`, where `entity` is the *parent* comment
 * that was replied to — see docs/api-reference.md — so `entity.post` is used instead; there's no
 * way to deep-link to the reply itself, but the post is still the right destination). Only
 * `follow_user` (`entityType: 'user'`) links to a profile. Clicking always marks it read,
 * whether or not it already was.
 */
@Component({
  selector: 'app-notification-item',
  imports: [NgOptimizedImage, RouterLink, TranslatePipe],
  templateUrl: './notification-item.html',
  styleUrl: './notification-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationItem {
  private readonly notificationsService = inject(NotificationsService);
  private readonly languageService = inject(LanguageService);

  readonly notification = input.required<AppNotification>();

  /**
   * A reply notification shares `type: "comment_post"` with a top-level-comment notification —
   * only `entityType` ("comment" vs "post") tells them apart (see docs/api-reference.md).
   */
  // Falls back to a generic "did something" message for any `type` this app doesn't know
  // about yet — the API could add a new notification type at any time, and a `switch` with no
  // matching case would otherwise silently render nothing (an untranslated `undefined` key)
  // instead of degrading gracefully.
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
      default:
        return 'notifications.messages.unknown';
    }
  });

  protected readonly formattedDate = computed(() => this.formatDate(this.notification().createdAt));

  /**
   * Falls back to the actor's own profile for any `entityType` outside the three documented
   * values, or when a "comment" entity is missing the `post` field it's supposed to always
   * have — same defensive reasoning as `messageKey`: don't let one malformed/future-shaped
   * notification produce a broken `/posts/undefined` link, degrade to the one destination that's
   * always valid instead.
   */
  protected readonly targetLink = computed((): [string, string] => {
    const notification = this.notification();
    if (notification.entityType === 'post') {
      return ['/posts', notification.entityId];
    }
    if (notification.entityType === 'comment') {
      const postId = (notification.entity as NotificationCommentEntity | undefined)?.post;
      if (postId) {
        return ['/posts', postId];
      }
    }
    // `/profile/undefined` (a broken link) is still better than throwing outright if `actor`
    // is ever missing too — the row itself already degrades gracefully in that case (see
    // notification-item.html's `@else` for the avatar/name).
    return ['/profile', notification.actor?._id ?? ''];
  });

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
