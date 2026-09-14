import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, signal, type WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language';
import { StatusIndicator } from '../../../shared/status-indicator/status-indicator';
import type { Post } from '../feed.interface';
import { PostsService } from '../services/posts.service';

@Component({
  selector: 'app-post-card',
  imports: [NgOptimizedImage, MatButtonModule, MatIcon, MatProgressSpinnerModule, TranslatePipe, StatusIndicator],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  private readonly authService = inject(AuthService);
  private readonly postsService = inject(PostsService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  readonly post = input.required<Post>();

  protected readonly isLiked = computed(() => this.postsService.isLikedBy(this.post(), this.authService.user()?._id));
  protected readonly formattedDate = computed(() => this.formatDate(this.post().createdAt));

  protected readonly isLiking = signal(false);
  protected readonly isBookmarking = signal(false);
  protected readonly isSharing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected async onToggleLike(): Promise<void> {
    await this.runAction(this.isLiking, () => this.postsService.toggleLike(this.post().id));
  }

  protected async onToggleBookmark(): Promise<void> {
    await this.runAction(this.isBookmarking, () => this.postsService.toggleBookmark(this.post().id));
  }

  protected async onShare(): Promise<void> {
    await this.runAction(this.isSharing, () => this.postsService.sharePost(this.post().id));
  }

  private async runAction(pending: WritableSignal<boolean>, action: () => Promise<void>): Promise<void> {
    if (pending()) {
      return;
    }
    pending.set(true);
    this.actionError.set(null);
    try {
      await action();
    } catch {
      this.actionError.set(this.translate.translate('feed.postCard.errors.actionFailed')() as string);
    } finally {
      pending.set(false);
    }
  }

  /**
   * Timestamps are formatted, not "live now"-relative, so this only ever parses the post's
   * fixed `createdAt` string — never `new Date()` with no argument — and stays SSR-safe (see
   * AGENTS.md > Templates on not assuming a current-time global is available).
   */
  private formatDate(createdAt: string): string {
    const locale = this.languageService.lang() === 'ar' ? 'ar' : 'en';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(createdAt));
  }
}
