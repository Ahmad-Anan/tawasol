import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { CommentComposer } from '../comment-composer/comment-composer';
import { CommentItem } from '../comment-item/comment-item';
import { CommentsService } from '../services/comments.service';

/**
 * A post's top-level comments — rendered by PostCard only while its `showComments` is true (an
 * `@if` there creates/destroys this component), so calling loadComments() once this component
 * exists already gives "load on open, not before"; `postId` never changes within one instance's
 * lifetime, so the effect below only ever fires once in practice. Mirrors FeedPage's own
 * sentinel-based infinite scroll — GET /posts/:postId/comments genuinely supports pagination
 * (see docs/api-reference.md), unlike the profile feature's post list.
 */
@Component({
  selector: 'app-comments-list',
  imports: [CommentComposer, CommentItem, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './comments-list.html',
  styleUrl: './comments-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsList {
  protected readonly commentsService = inject(CommentsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly postId = input.required<string>();

  protected readonly thread = computed(() => this.commentsService.threadFor(this.postId())());

  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  constructor() {
    // A required input() signal isn't guaranteed to have a value yet inside the constructor
    // body itself (Angular's compiler flags reading one there as NG8118) — only once the
    // initial input-binding pass has run, which `effect()` correctly waits for.
    effect(() => {
      void this.commentsService.loadComments(this.postId());
    });

    effect((onCleanup) => {
      const element = this.scrollSentinel()?.nativeElement;
      if (!this.isBrowser || !element) {
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.commentsService.loadMoreComments(this.postId());
        }
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
