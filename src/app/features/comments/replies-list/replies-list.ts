import { Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CommentBody } from '../comment-body/comment-body';
import { CommentsService } from '../services/comments.service';

/**
 * Renders one comment's replies, indented under it. Mirrors CommentsList but reads/writes the
 * `_replyThreads` side of CommentsService instead of `_threads` — see that service's doc
 * comment. Renders CommentBody directly for each reply (not CommentItem — see CommentBody's own
 * doc comment on why: CommentItem and RepliesList need each other, and importing each other
 * directly is a real circular dependency, not just a style choice).
 *
 * This component only exists at all while its parent CommentItem's `showReplies` is true (an
 * `@if` there creates/destroys it), so loading once already gives "load on open, not before";
 * `parentCommentId`/`postId` never change within one instance's lifetime, so the effect below
 * only ever fires once in practice. It has to be an effect, not a plain constructor call — a
 * required input() signal isn't guaranteed to have a value yet inside the constructor body
 * itself (Angular's compiler flags that as NG8118).
 */
@Component({
  selector: 'app-replies-list',
  imports: [CommentBody, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './replies-list.html',
  styleUrl: './replies-list.css',
})
export class RepliesList {
  protected readonly commentsService = inject(CommentsService);

  readonly postId = input.required<string>();
  readonly parentCommentId = input.required<string>();

  protected readonly thread = computed(() => this.commentsService.repliesFor(this.parentCommentId())());

  constructor() {
    effect(() => {
      void this.commentsService.loadReplies(this.postId(), this.parentCommentId());
    });
  }

  protected loadMore(): void {
    void this.commentsService.loadMoreReplies(this.postId(), this.parentCommentId());
  }
}
