import { NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { MAX_IMAGE_MB, composerImageError } from '../../../shared/composer/composer-image';
import type { ApiErrorResponse } from '../../../shared/interfaces/api-response.interface';
import { PostsService } from '../services/posts.service';

interface CreatePostFormModel {
  body: string;
}

/**
 * Composer behaviour follows LinkedIn/Facebook/X: there is no "empty post" error. Post stays
 * disabled until there's non-whitespace text or an image (the API doesn't enforce "at least one
 * of body/image" for posts — see docs/api-reference.md > POST /posts — so this is the only guard),
 * and red text is reserved for real failures: the API rejecting the post, or an unusable image.
 */
@Component({
  selector: 'app-create-post',
  imports: [
    NgOptimizedImage,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './create-post.html',
  styleUrl: './create-post.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePost {
  private readonly authService = inject(AuthService);
  private readonly postsService = inject(PostsService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentUser = this.authService.user;
  protected readonly imageFile = signal<File | null>(null);
  protected readonly imagePreviewUrl = signal<string | null>(null);
  /** A real failure only: the API rejected/failed the post, or the picked image is unusable. */
  protected readonly error = signal<string | null>(null);

  protected readonly model = signal<CreatePostFormModel>({ body: '' });
  // No validators: an empty composer disables Post instead of showing an error.
  protected readonly createForm = form(this.model);

  protected readonly canPost = computed(() => this.model().body.trim().length > 0 || this.imageFile() !== null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Allows re-selecting the same file later (browsers don't fire `change` again for an
    // unchanged value otherwise).
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
    // The Post button stays focusable while disabled (disabledInteractive, so screen readers can
    // reach it and hear why), which means a click can still land here — ignore it.
    if (!this.canPost() || this.createForm().submitting()) {
      return;
    }
    this.error.set(null);
    await submit(this.createForm, async (field) => {
      try {
        const body = field().value().body.trim();
        await this.postsService.createPost({ body: body || undefined, image: this.imageFile() });
        // Back to a clean, untouched composer — empty text, no image, no error styling.
        this.createForm().reset({ body: '' });
        this.setImage(null);
      } catch (err) {
        this.error.set(this.extractErrorMessage(err));
      }
      return undefined;
    });
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

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiErrorResponse | undefined;
      // The API only ever replies in English and has no locale negotiation, so its message is
      // shown verbatim; only the app's own fallback below is localized.
      if (body?.message) {
        return body.message;
      }
    }
    return this.translate.translate('feed.createPost.errors.unexpected')() as string;
  }
}
