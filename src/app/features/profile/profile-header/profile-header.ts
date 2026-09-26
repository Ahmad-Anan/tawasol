import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DemoAccountService } from '../../../core/services/demo-account';
import { isolateBidi } from '../../../shared/bidi/isolate-bidi';
import { FollowButton } from '../../../shared/follow-button/follow-button';
import { openImageLightbox } from '../../../shared/image-lightbox/image-lightbox';
import { ProfileService } from '../services/profile.service';
import {
  SuggestedFriendsDialog,
  type SuggestedFriendsDialogData,
} from '../../suggestions/suggested-friends-dialog/suggested-friends-dialog';

/**
 * There's no name/bio-editing endpoint in this API (see docs/api-reference.md) — the only
 * thing about a profile that's actually editable is its photo. "Edit Profile" is therefore
 * wired to the same file picker as the small camera button on the avatar, not a separate form.
 */
@Component({
  selector: 'app-profile-header',
  imports: [
    FollowButton,
    NgOptimizedImage,
    MatButtonModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './profile-header.html',
  styleUrl: './profile-header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeader {
  protected readonly profileService = inject(ProfileService);
  protected readonly demoAccount = inject(DemoAccountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  protected readonly isolateBidi = isolateBidi;

  protected readonly previewUrl = signal<string | null>(null);
  private readonly selectedFile = signal<File | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.revokePreview());
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // The picker can't open from the disabled buttons, but never stage a demo-account photo.
    this.setFile(this.demoAccount.isDemo() ? null : file);
    // Allows re-selecting the same file later (browsers don't fire `change` again otherwise).
    input.value = '';
  }

  /**
   * There's no API endpoint for a user's actual followers/following list (verified live — see
   * docs/api-reference.md) — this opens the suggested-friends dialog instead, which makes that
   * limitation explicit to the person clicking rather than silently doing nothing or (worse)
   * pretending to show a real list.
   */
  protected openSuggestionsDialog(context: SuggestedFriendsDialogData['context']): void {
    this.dialog.open(SuggestedFriendsDialog, {
      data: { context },
      autoFocus: 'first-tabbable',
      width: '420px',
    });
  }

  protected openPhoto(src: string): void {
    openImageLightbox(this.dialog, this.translate, {
      src,
      altKey: 'shared.imageLightbox.profilePhoto',
    });
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
