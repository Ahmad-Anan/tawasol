import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { FollowService } from '../../core/services/follow';
import { UnfollowConfirmData, UnfollowConfirmDialog } from './unfollow-confirm-dialog';

/**
 * The one Follow control used everywhere (profile header, suggested friends), following the
 * LinkedIn/X pattern:
 * - "Follow" follows straight away.
 * - Once followed it reads "Following ✓" (and "Unfollow" on hover, on devices that hover).
 * - Clicking "Following" asks "Unfollow {name}?" first.
 *
 * State, the optimistic update/rollback and the in-flight lock all live in FollowService; this
 * only renders them. It's a single <button> whose appearance changes, rather than two buttons
 * swapped by @if, so keyboard focus stays on it after following or unfollowing. While a request
 * is in flight it's disabled but still focusable (disabledInteractive) for the same reason.
 * Errors are rendered by the host, which knows where there's room (see FollowService.failure).
 */
@Component({
  selector: 'app-follow-button',
  imports: [MatButtonModule, MatIcon, TranslatePipe],
  templateUrl: './follow-button.html',
  styleUrl: './follow-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class FollowButton {
  private readonly followService = inject(FollowService);
  private readonly dialog = inject(MatDialog);

  readonly userId = input.required<string>();
  /** Shown in the confirmation and accessible labels. */
  readonly name = input.required<string>();
  /** Compact: an outlined Follow for dense lists; default: the prominent filled Follow. */
  readonly size = input<'default' | 'compact'>('default');

  protected readonly following = computed(() => this.followService.isFollowing(this.userId()));
  protected readonly pending = computed(() => this.followService.isPending(this.userId()));
  protected readonly appearance = computed(() =>
    this.following() || this.size() === 'compact' ? 'outlined' : 'filled',
  );

  protected async onClick(): Promise<void> {
    if (this.pending()) {
      return;
    }
    if (!this.following()) {
      await this.followService.follow(this.userId());
      return;
    }
    const confirmed = await firstValueFrom(
      this.dialog
        .open<UnfollowConfirmDialog, UnfollowConfirmData, boolean>(UnfollowConfirmDialog, {
          data: { name: this.name() },
          role: 'alertdialog',
          ariaLabelledBy: 'unfollow-confirm-title',
          autoFocus: 'first-tabbable',
          width: '320px',
        })
        .afterClosed(),
    );
    if (confirmed) {
      await this.followService.unfollow(this.userId());
    }
  }
}
