import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MAX_IMAGE_MB, composerImageError } from '../../../shared/composer/composer-image';
import { CommentsService } from '../services/comments.service';

let nextComposerId = 0;

/**
 * Shared by both "new comment" and "new reply" — the only difference is whether
 * `parentCommentId` is set, which decides which CommentsService method to call and which
 * placeholder to show. Mirrors CreatePost's image-preview/revoke pattern, but with plain
 * signals instead of Signal Forms (matches PostCard's own inline edit form, not the page-level
 * CreatePost form) since this is a small, reused component rather than a primary page form.
 *
 * Same composer behaviour as CreatePost: no "empty comment" error — Post stays disabled until
 * there's non-whitespace text or an image, and red text is reserved for real failures.
 */
@Component({
  selector: 'app-comment-composer',
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './comment-composer.html',
  styleUrl: './comment-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentComposer {
  private readonly authService = inject(AuthService);
  private readonly commentsService = inject(CommentsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly postId = input.required<string>();
  readonly parentCommentId = input<string | null>(null);
  /** Emitted once a comment/reply is successfully posted, so a parent can e.g. collapse the reply box. */
  readonly posted = output<void>();

  protected readonly currentUser = this.authService.user;
  protected readonly content = signal('');
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreviewUrl = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  /** A real failure only: the API rejected/failed the comment, or the picked image is unusable. */
  protected readonly error = signal<string | null>(null);

  protected readonly canPost = computed(() => this.content().trim().length > 0 || this.imageFile() !== null);
  /** Unique per instance — several composers (the post's and each open reply box) can be on screen. */
  protected readonly emptyHintId = `comment-composer-empty-hint-${nextComposerId++}`;

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onContentInput(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    const imageError = composerImageError(file);
    if (imageError) {
      this.error.set(
        this.translate.translate(`shared.composer.errors.${imageError === 'type' ? 'imageType' : 'imageSize'}`, {
          max: MAX_IMAGE_MB,
        })() as string,
      );
      return;
    }
    this.error.set(null);
    this.setImage(file);
  }

  protected removeImage(): void {
    this.setImage(null);
  }

  protected async onSubmit(): Promise<void> {
    // The disabled Post button stays focusable (disabledInteractive), so a click can still land
    // here while there's nothing to post — ignore it rather than showing an error.
    if (this.isSubmitting() || !this.canPost()) {
      return;
    }
    const content = this.content().trim();
    this.isSubmitting.set(true);
    this.error.set(null);
    try {
      const payload = { content: content || undefined, image: this.imageFile() };
      const parentCommentId = this.parentCommentId();
      if (parentCommentId) {
        await this.commentsService.addReply(this.postId(), parentCommentId, payload);
      } else {
        await this.commentsService.addComment(this.postId(), payload);
      }
      this.content.set('');
      this.setImage(null);
      this.posted.emit();
    } catch {
      this.error.set(this.translate.translate('comments.errors.actionFailed')() as string);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private setImage(file: File | null): void {
    this.revokePreview();
    this.imageFile.set(file);
    this.imagePreviewUrl.set(file ? URL.createObjectURL(file) : null);
  }

  private revokePreview(): void {
    const url = this.imagePreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
