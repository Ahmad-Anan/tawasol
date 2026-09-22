import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import type { Comment } from '../comments.interface';
import { CommentBody } from '../comment-body/comment-body';
import { CommentComposer } from '../comment-composer/comment-composer';
import { RepliesList } from '../replies-list/replies-list';

/**
 * A top-level comment: CommentBody (the actual per-comment markup) plus, once the user clicks
 * "Reply" or "View replies" there, a reply CommentComposer and/or a nested RepliesList. Used
 * only for top-level comments — RepliesList renders CommentBody directly for each reply,
 * without going through this wrapper, since a reply can't itself have a reply thread. See
 * CommentBody's own doc comment for why this split exists (breaking a circular dependency
 * between this component and RepliesList).
 */
@Component({
  selector: 'app-comment-item',
  imports: [CommentBody, CommentComposer, RepliesList],
  templateUrl: './comment-item.html',
  styleUrl: './comment-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentItem {
  readonly comment = input.required<Comment>();
  readonly postId = input.required<string>();

  protected readonly isReplying = signal(false);
  protected readonly showReplies = signal(false);

  protected toggleReplying(): void {
    this.isReplying.update((value) => !value);
  }

  protected toggleReplies(): void {
    this.showReplies.update((value) => !value);
  }

  /** A newly-posted reply should be visible immediately, not just counted. */
  protected onReplyPosted(): void {
    this.isReplying.set(false);
    this.showReplies.set(true);
  }
}
