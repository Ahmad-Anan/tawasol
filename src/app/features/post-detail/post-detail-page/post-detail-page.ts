import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { PostCard } from '../../feed/post-card/post-card';
import { PostsService } from '../../feed/services/posts.service';

/**
 * Permalink view for a single post (`GET /posts/:id`) — reached from a notification
 * (like/comment/share/reply, all of which concern a specific post) or a direct link. Reuses
 * `PostCard` as-is (with `expandCommentsByDefault` set, so the full comment thread is visible
 * immediately rather than needing an extra click) instead of a bespoke layout, so like/bookmark/
 * share/edit/delete all keep working exactly as they do in the feed.
 */
@Component({
  selector: 'app-post-detail-page',
  imports: [PostCard, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './post-detail-page.html',
  styleUrl: './post-detail-page.css',
})
export class PostDetailPage {
  protected readonly postsService = inject(PostsService);
  private readonly route = inject(ActivatedRoute);

  private readonly postId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly post = computed(() => this.postsService.posts().find((post) => post.id === this.postId()));

  constructor() {
    // Re-loads on every :id change, not just on first mount — same reasoning as ProfilePage:
    // Angular reuses this component instance when navigating from one post's permalink
    // straight to another's (e.g. a notification link clicked from an already-open permalink
    // page).
    effect(() => {
      const id = this.postId();
      if (id) {
        void this.postsService.loadPost(id);
      }
    });
  }
}
