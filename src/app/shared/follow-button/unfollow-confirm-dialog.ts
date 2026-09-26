import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { isolateBidi } from '../bidi/isolate-bidi';

export interface UnfollowConfirmData {
  name: string;
}

/**
 * "Unfollow {name}?" — opened by FollowButton before unfollowing (LinkedIn/X pattern), so a
 * stray click on "Following" can't unfollow anyone. Closes with `true` only on Unfollow; Cancel,
 * Escape and a backdrop click all close with nothing. Cancel comes first so it's the initially
 * focused (safe) action.
 */
@Component({
  selector: 'app-unfollow-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title id="unfollow-confirm-title" style="font-family: var(--font-display)">
      {{ 'shared.follow.confirmTitle' | translate: { name: isolateBidi(data.name) } }}
    </h2>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        {{ 'shared.follow.cancel' | translate }}
      </button>
      <button mat-flat-button type="button" class="composer-submit" [mat-dialog-close]="true">
        {{ 'shared.follow.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnfollowConfirmDialog {
  protected readonly data = inject<UnfollowConfirmData>(MAT_DIALOG_DATA);
  protected readonly isolateBidi = isolateBidi;
}
