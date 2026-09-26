import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language';
import { openImageLightbox } from '../../../shared/image-lightbox/image-lightbox';
import { StatusIndicator } from '../../../shared/status-indicator/status-indicator';
import { formatFullTimestamp, formatShortTimestamp } from '../../../shared/timestamp/timestamp';
import type { Comment } from '../comments.interface';
import { CommentsService } from '../services/comments.service';

/**
 * Pure per-comment rendering — avatar/name/content/image, like, edit/delete (canEdit-style,
 * mirroring PostCard's isOwnPost), and, for a top-level comment only, "Reply"/"View replies"
 * buttons (as outputs — this component has no opinion on what happens when they're clicked).
 *
 * Deliberately has ZERO dependency on CommentItem or RepliesList: those two *do* need each
 * other (RepliesList renders one CommentItem-ish row per reply; CommentItem renders a nested
 * RepliesList when expanded), and importing each other directly is a genuine circular ES module
 * dependency — verified live, it builds fine but throws `NG0919: Cannot read @Component
 * metadata` at runtime under the dev server the moment one is instantiated from the other.
 * Splitting the actual per-comment markup out here breaks the cycle: CommentItem imports both
 * CommentBody and RepliesList; RepliesList imports only CommentBody. A DAG, not a cycle.
 */
@Component({
  selector: 'app-comment-body',
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
  templateUrl: './comment-body.html',
  styleUrl: './comment-body.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentBody {
  private readonly authService = inject(AuthService);
  private readonly commentsService = inject(CommentsService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  readonly comment = input.required<Comment>();
  readonly postId = input.required<string>();
  /** Set only when this comment IS a reply — see CommentsService's own `parentCommentId` parameter. */
  readonly parentCommentId = input<string | null>(null);
  /** Whether the parent CommentItem currently has this comment's replies expanded — purely for the button label. */
  readonly repliesExpanded = input(false);

  readonly replyClicked = output<void>();
  readonly viewRepliesClicked = output<void>();

  protected readonly isReply = computed(() => this.parentCommentId() !== null);
  protected readonly isOwnComment = computed(
    () => this.comment().commentCreator._id === this.authService.user()?._id,
  );
  protected readonly isLiked = computed(() =>
    this.commentsService.isLikedBy(this.comment(), this.authService.user()?._id),
  );
  /**
   * Read once, only to decide whether a timestamp needs its year. Same short/full pair as the post
   * card (see shared/timestamp) so every date in the app reads the same way.
   */
  private readonly currentYear = new Date().getFullYear();
  private readonly dateLocale = computed(() => (this.languageService.lang() === 'ar' ? 'ar' : 'en'));
  protected readonly shortDate = computed(() => formatShortTimestamp(this.comment().createdAt, this.dateLocale(), this.currentYear));
  protected readonly fullDate = computed(() => formatFullTimestamp(this.comment().createdAt, this.dateLocale()));

  protected readonly isLiking = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly isEditing = signal(false);
  protected readonly editContent = signal('');
  protected readonly isSavingEdit = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly isConfirmingDelete = signal(false);
  protected readonly isDeleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected openImage(src: string): void {
    openImageLightbox(this.dialog, this.translate, { src, altKey: 'shared.imageLightbox.commentImage' });
  }

  protected async onToggleLike(): Promise<void> {
    if (this.isLiking()) {
      return;
    }
    this.isLiking.set(true);
    this.actionError.set(null);
    try {
      await this.commentsService.toggleLike(this.postId(), this.comment()._id, this.parentCommentId());
    } catch {
      this.actionError.set(this.translate.translate('comments.errors.actionFailed')() as string);
    } finally {
      this.isLiking.set(false);
    }
  }

  protected startEdit(): void {
    this.editError.set(null);
    this.editContent.set(this.comment().content ?? '');
    this.isEditing.set(true);
  }

  protected cancelEdit(): void {
    this.isEditing.set(false);
  }

  protected onEditContentInput(event: Event): void {
    this.editContent.set((event.target as HTMLTextAreaElement).value);
  }

  protected async saveEdit(): Promise<void> {
    if (this.isSavingEdit()) {
      return;
    }
    const content = this.editContent().trim();
    if (!content) {
      this.editError.set(this.translate.translate('comments.errors.contentRequired')() as string);
      return;
    }
    this.isSavingEdit.set(true);
    this.editError.set(null);
    try {
      await this.commentsService.editComment(this.postId(), this.comment()._id, this.parentCommentId(), content);
      this.isEditing.set(false);
    } catch {
      this.editError.set(this.translate.translate('comments.errors.actionFailed')() as string);
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

  protected async deleteComment(): Promise<void> {
    if (this.isDeleting()) {
      return;
    }
    this.isDeleting.set(true);
    this.deleteError.set(null);
    try {
      await this.commentsService.deleteComment(this.postId(), this.comment()._id, this.parentCommentId());
    } catch {
      this.deleteError.set(this.translate.translate('comments.errors.actionFailed')() as string);
    } finally {
      this.isDeleting.set(false);
    }
  }
}
