import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  type WritableSignal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { DemoAccountService } from '../../../core/services/demo-account';
import { LanguageService } from '../../../core/services/language';
import { openImageLightbox } from '../../../shared/image-lightbox/image-lightbox';
import { StatusIndicator } from '../../../shared/status-indicator/status-indicator';
import { CommentsList } from '../../comments/comments-list/comments-list';
import type { Post } from '../feed.interface';
import { PostLikesDialog } from '../post-likes-dialog/post-likes-dialog';
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
    RouterLink,
    TranslatePipe,
    StatusIndicator,
    CommentsList,
  ],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCard {
  private readonly authService = inject(AuthService);
  private readonly demoAccount = inject(DemoAccountService);
  private readonly postsService = inject(PostsService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  readonly post = input.required<Post>();
  /** Set by PostDetailPage so its permalink view opens with comments already visible. */
  readonly expandCommentsByDefault = input(false);

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
  /** False only for the demo account's pre-existing posts (see DemoAccountService). */
  protected readonly canDelete = computed(() => this.demoAccount.canDeletePost(this.post().id));

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

  // `linkedSignal`, not a plain `signal(false)`: it needs to track `expandCommentsByDefault()`
  // (true on PostDetailPage, false everywhere else) while still being locally toggleable by
  // `toggleComments()` below without that toggle being immediately overwritten back to the
  // input's value — exactly the "derived from a reactive source but independently settable"
  // case `linkedSignal` exists for.
  protected readonly showComments = linkedSignal(() => this.expandCommentsByDefault());

  protected openLikesDialog(): void {
    this.dialog.open(PostLikesDialog, { data: { postId: this.post().id }, autoFocus: 'first-tabbable', width: '380px' });
  }

  protected openImage(src: string): void {
    openImageLightbox(this.dialog, this.translate, { src, altKey: 'shared.imageLightbox.postImage' });
  }

  /**
   * The top-comment preview under each card (see post-card.html) reads `post().topComment`
   * directly instead of a dedicated `CommentsService` fetch — every full-shape post (feed,
   * profile, bookmarks) already carries its own top comment inline (see
   * docs/api-reference.md > "The 'post' object has two different shapes…"), so there's no
   * network request to make here at all, let alone one worth lazy-loading behind an
   * IntersectionObserver. Fetching it separately via CommentsService would mean a second,
   * possibly-inconsistent source of truth for the same comment and a redundant request per
   * visible post — exactly the kind of avoidable extra fetch this codebase's race-condition
   * lessons (PostsService/BookmarksService/CommentsService's own doc comments) argue against.
   */
  protected toggleComments(): void {
    this.showComments.update((value) => !value);
  }

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
    // The menu item is disabled (with a note) when this is false; this is the backstop.
    if (!this.canDelete()) {
      return;
    }
    this.deleteError.set(null);
    this.isConfirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.isConfirmingDelete.set(false);
  }

  protected async deletePost(): Promise<void> {
    if (this.isDeleting() || !this.canDelete()) {
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
