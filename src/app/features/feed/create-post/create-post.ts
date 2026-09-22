import { NgOptimizedImage } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormField, form, validate, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import type { ApiErrorResponse } from '../../../shared/interfaces/api-response.interface';
import { PostsService } from '../services/posts.service';

interface CreatePostFormModel {
  body: string;
}

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
  protected readonly serverError = signal<string | null>(null);

  protected readonly model = signal<CreatePostFormModel>({ body: '' });
  protected readonly createForm = form(this.model, (p) => {
    // "At least one of body/image" isn't a per-field constraint the API documents (see
    // docs/api-reference.md > POST /posts) — enforced client-side instead. Reading the
    // `imageFile` signal here re-runs this validator reactively whenever an image is
    // added/removed, same trick Login/Register use for translate() inside a validator.
    validate(p.body, (ctx) =>
      ctx.value().trim().length > 0 || this.imageFile() !== null
        ? undefined
        : {
            kind: 'required',
            message: this.translate.translate('feed.createPost.errors.contentRequired')() as string,
          },
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setImage(file);
    // Allows re-selecting the same file later (browsers don't fire `change` again for an
    // unchanged value otherwise).
    input.value = '';
  }

  protected removeImage(): void {
    this.setImage(null);
  }

  protected async onSubmit(): Promise<void> {
    this.serverError.set(null);
    await submit(this.createForm, async (field) => {
      try {
        const body = field().value().body.trim();
        await this.postsService.createPost({ body: body || undefined, image: this.imageFile() });
        this.model.set({ body: '' });
        this.setImage(null);
      } catch (err) {
        this.serverError.set(this.extractErrorMessage(err));
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
      if (body?.message) {
        return body.message;
      }
    }
    return this.translate.translate('feed.createPost.errors.unexpected')() as string;
  }
}
