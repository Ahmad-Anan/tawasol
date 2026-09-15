import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, signal, type WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language';
import { StatusIndicator } from '../../../shared/status-indicator/status-indicator';
import type { Post } from '../feed.interface';
import { PostsService } from '../services/posts.service';

@Component({
  selector: 'app-post-card',
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    StatusIndicator,
  ],
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

  /**
   * Ownership (and so edit/delete) is about `post()` itself, not `displayedPost` — for a
   * share, that's the share wrapper the current user created, never the original author's
   * post nested inside it.
   */
  protected readonly isOwnPost = computed(() => this.post().user._id === this.authService.user()?._id);
  /** Shares carry no editable body/image of their own (see PostsService.sharePost docs). */
  protected readonly canEdit = computed(() => this.isOwnPost() && !this.post().isShare);

  protected readonly isLiking = signal(false);
  protected readonly isBookmarking = signal(false);
  protected readonly isSharing = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly isEditing = signal(false);
  protected readonly editBody = signal('');
  protected readonly isSavingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly isConfirmingDelete = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

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

  protected startEdit(): void {
    this.editError.set(null);
    this.editBody.set(this.post().body ?? '');
    this.isEditing.set(true);
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
  }

  protected onEditBodyInput(event: Event): void {
    this.editBody.set((event.target as HTMLTextAreaElement).value);
  }

  protected async saveEdit(): Promise<void> {
    if (this.isSavingEdit()) {
      return;
    }
    const body = this.editBody().trim();
    if (!body) {
      this.editError.set(this.translate.translate('feed.postCard.errors.editBodyRequired')() as string);
      return;
    }
    this.isSavingEdit.set(true);
    this.editError.set(null);
    try {
      await this.postsService.editPost(this.post().id, { body });
      this.isEditing.set(false);
    } catch {
      this.editError.set(this.translate.translate('feed.postCard.errors.actionFailed')() as string);
    } finally {
      this.isSavingEdit.set(false);
    }
  }

  protected confirmDelete(): void {
    this.deleteError.set(null);
    this.isConfirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.isConfirmingDelete.set(false);
  }

  protected async deletePost(): Promise<void> {
    if (this.isDeleting()) {
      return;
    }
    this.isDeleting.set(true);
    this.deleteError.set(null);
    try {
      await this.postsService.deletePost(this.post().id);
    } catch {
      this.deleteError.set(this.translate.translate('feed.postCard.errors.actionFailed')() as string);
    } finally {
      this.isDeleting.set(false);
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
