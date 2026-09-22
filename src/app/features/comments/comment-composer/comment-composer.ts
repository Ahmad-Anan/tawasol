import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { CommentsService } from '../services/comments.service';

/**
 * Shared by both "new comment" and "new reply" — the only difference is whether
 * `parentCommentId` is set, which decides which CommentsService method to call and which
 * placeholder to show. Mirrors CreatePost's image-preview/revoke pattern, but with plain
 * signals instead of Signal Forms (matches PostCard's own inline edit form, not the page-level
 * CreatePost form) since this is a small, reused component rather than a primary page form.
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
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onContentInput(event: Event): void {
    this.content.set((event.target as HTMLTextAreaElement).value);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setImage(file);
    input.value = '';
  }

  protected removeImage(): void {
    this.setImage(null);
  }

  protected async onSubmit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }
    const content = this.content().trim();
    if (!content && !this.imageFile()) {
      this.error.set(this.translate.translate('comments.errors.contentRequired')() as string);
      return;
    }
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
