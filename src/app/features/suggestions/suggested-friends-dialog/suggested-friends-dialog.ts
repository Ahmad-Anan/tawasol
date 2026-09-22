import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { SuggestedFriends } from '../suggested-friends/suggested-friends';

/** Which stat card on the profile this dialog was opened from — picks the dialog's title/disclaimer wording. */
export interface SuggestedFriendsDialogData {
  context: 'followers' | 'following';
}

/**
 * Opened from ProfileHeader's Followers/Following stat cards. There is no API endpoint that
 * returns the actual list of a user's followers/following (verified live — see
 * docs/api-reference.md, "No endpoint returns the actual list of followers/following users"),
 * so this deliberately does NOT pretend to show that person's real followers/following. It
 * reuses the existing `SuggestedFriends` widget as-is (same infinite scroll, same
 * SuggestionsService, no duplicated logic) with an explicit disclaimer above it so the person
 * clicking a follower/following count isn't misled into thinking this is their real list.
 */
@Component({
  selector: 'app-suggested-friends-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe, SuggestedFriends],
  templateUrl: './suggested-friends-dialog.html',
  styleUrl: './suggested-friends-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestedFriendsDialog {
  protected readonly data = inject<SuggestedFriendsDialogData>(MAT_DIALOG_DATA);
}
