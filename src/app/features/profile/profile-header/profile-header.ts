import { NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ProfileService } from '../services/profile.service';

/**
 * There's no name/bio-editing endpoint in this API (see docs/api-reference.md) — the only
 * thing about a profile that's actually editable is its photo. "Edit Profile" is therefore
 * wired to the same file picker as the small camera button on the avatar, not a separate form.
 */
@Component({
  selector: 'app-profile-header',
  imports: [NgOptimizedImage, MatButtonModule, MatIcon, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './profile-header.html',
  styleUrl: './profile-header.css',
})
export class ProfileHeader {
  protected readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly previewUrl = signal<string | null>(null);
  private readonly selectedFile = signal<File | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setFile(file);
    // Allows re-selecting the same file later (browsers don't fire `change` again otherwise).
    input.value = '';
  }

  protected cancelPhotoChange(): void {
    this.setFile(null);
  }

  protected async confirmPhotoChange(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    await this.profileService.uploadPhoto(file);
    if (!this.profileService.uploadError()) {
      this.setFile(null);
    }
  }

  private setFile(file: File | null): void {
    this.revokePreview();
    this.selectedFile.set(file);
    this.previewUrl.set(file ? URL.createObjectURL(file) : null);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
