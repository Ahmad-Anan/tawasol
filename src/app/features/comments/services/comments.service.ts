import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, Signal, WritableSignal, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../../core/constants/api';
import type {
  Comment,
  CommentAuthor,
  CommentListItem,
  CommentLikeToggleApiResponse,
  CommentPayload,
  CommentsListApiResponse,
  CreateCommentApiResponse,
  CreateReplyApiResponse,
  EditCommentApiResponse,
  MutatedComment,
  RepliesListApiResponse,
} from '../comments.interface';

const COMMENTS_PAGE_SIZE = 10;

export interface CommentThreadState {
  comments: Comment[];
  page: number;
  hasMore: boolean;
  /** True once a fetch has ever completed for this thread — see loadComments/loadReplies. */
  hasFetched: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadError: boolean;
  loadMoreError: boolean;
}

function initialThreadState(): CommentThreadState {
  return {
    comments: [],
    page: 1,
    hasMore: false,
    hasFetched: false,
    isLoading: false,
    isLoadingMore: false,
    loadError: false,
    loadMoreError: false,
  };
}

/**
 * Signal-based state for comments, organized the same way the feature is actually used: a
 * post's comments and a comment's replies are opened independently and on demand (a user
 * expanding one post's comments — or one comment's replies — has no bearing on any other), so
 * state lives in two `Map`s of per-key signals rather than one flat list like PostsService.
 * `_threads` is keyed by postId (top-level comments); `_replyThreads` is keyed by the parent
 * comment's id (replies) — a reply is just a comment with `parentComment` set (verified live,
 * see docs/api-reference.md), so both maps hold the same `Comment` shape and reuse the same
 * mutation logic, just addressed differently.
 *
 * IMPORTANT (the lesson from the feed/profile/bookmarks race condition): nothing here fetches
 * merely by being constructed or injected — `loadComments`/`loadReplies` are plain methods that
 * only ever run when explicitly called. Unlike PostsService/BookmarksService, this doesn't use
 * `rxResource` at all: comments are inherently per-key (one post, one comment) rather than a
 * single reactive stream, and a dynamically-created `rxResource` per key would need its own
 * `Injector` plumbing for no real benefit over a plain `async` method here — `CommentsList`/
 * `RepliesList` call `loadComments`/`loadReplies` from an `effect()` in their own constructor
 * (required so a required `input()` has a value by the time it's read — see those components'
 * own doc comments), which only exists at all when Angular actually creates them (i.e. when a
 * comments/replies section is expanded via `@if` in the parent template) — the same "activated
 * by the one component that needs it" guarantee `start()` gives PostsService/BookmarksService,
 * just via component lifecycle instead of an extra method.
 */
@Service()
export class CommentsService {
  private readonly http = inject(HttpClient);

  private readonly _threads = new Map<string, WritableSignal<CommentThreadState>>();
  private readonly _replyThreads = new Map<string, WritableSignal<CommentThreadState>>();
  private readonly emptyThread: Signal<CommentThreadState> = signal(initialThreadState()).asReadonly();

  /** Read-only view of a post's top-level comments. Always safe to call, even before loadComments(). */
  threadFor(postId: string): Signal<CommentThreadState> {
    return this._threads.get(postId) ?? this.emptyThread;
  }

  /** Read-only view of a comment's replies. Always safe to call, even before loadReplies(). */
  repliesFor(commentId: string): Signal<CommentThreadState> {
    return this._replyThreads.get(commentId) ?? this.emptyThread;
  }

  async loadComments(postId: string): Promise<void> {
    const state = this.getOrCreate(this._threads, postId);
    if (state().hasFetched || state().isLoading) {
      return;
    }
    state.update((s) => ({ ...s, isLoading: true, loadError: false }));
    try {
      const response = await this.fetchComments(postId, 1);
      this.mergePage(state, response.data.comments.map(fromListItem), 1, response.meta.pagination.nextPage !== undefined);
    } catch {
      state.update((s) => ({ ...s, isLoading: false, loadError: true }));
    }
  }

  async loadMoreComments(postId: string): Promise<void> {
    const state = this.getOrCreate(this._threads, postId);
    const current = state();
    if (!current.hasMore || current.isLoading) {
      return;
    }
    // `page` is committed to state now, before the fetch resolves either way — not just on
    // success in mergePage() — so that a failed attempt's page number survives into
    // `current.page` for the retry branch above to reuse, instead of re-requesting the page
    // that already succeeded.
    const page = current.loadMoreError ? current.page : current.page + 1;
    state.update((s) => ({ ...s, page, isLoadingMore: true, loadMoreError: false }));
    try {
      const response = await this.fetchComments(postId, page);
      this.mergePage(state, response.data.comments.map(fromListItem), page, response.meta.pagination.nextPage !== undefined);
    } catch {
      state.update((s) => ({ ...s, isLoadingMore: false, loadMoreError: true }));
    }
  }

  async loadReplies(postId: string, commentId: string): Promise<void> {
    const state = this.getOrCreate(this._replyThreads, commentId);
    if (state().hasFetched || state().isLoading) {
      return;
    }
    state.update((s) => ({ ...s, isLoading: true, loadError: false }));
    try {
      const response = await this.fetchReplies(postId, commentId, 1);
      this.mergePage(
        state,
        response.data.replies.map(fromMutated),
        1,
        response.meta.pagination.nextPage !== undefined,
      );
    } catch {
      state.update((s) => ({ ...s, isLoading: false, loadError: true }));
    }
  }

  async loadMoreReplies(postId: string, commentId: string): Promise<void> {
    const state = this.getOrCreate(this._replyThreads, commentId);
    const current = state();
    if (!current.hasMore || current.isLoading) {
      return;
    }
    // See loadMoreComments — `page` is committed before the fetch so a failed page number
    // survives into `current.page` for the retry branch above.
    const page = current.loadMoreError ? current.page : current.page + 1;
    state.update((s) => ({ ...s, page, isLoadingMore: true, loadMoreError: false }));
    try {
      const response = await this.fetchReplies(postId, commentId, page);
      this.mergePage(
        state,
        response.data.replies.map(fromMutated),
        page,
        response.meta.pagination.nextPage !== undefined,
      );
    } catch {
      state.update((s) => ({ ...s, isLoadingMore: false, loadMoreError: true }));
    }
  }

  async addComment(postId: string, payload: CommentPayload): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<CreateCommentApiResponse>(`${API_BASE_URL}/posts/${postId}/comments`, buildFormData(payload)),
    );
    const comment = fromMutated(response.data.comment);
    const state = this.getOrCreate(this._threads, postId);
    state.update((s) => ({ ...s, comments: [comment, ...s.comments] }));
  }

  async addReply(postId: string, parentCommentId: string, payload: CommentPayload): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<CreateReplyApiResponse>(
        `${API_BASE_URL}/posts/${postId}/comments/${parentCommentId}/replies`,
        buildFormData(payload),
      ),
    );
    const reply = fromMutated(response.data.reply);
    const state = this.getOrCreate(this._replyThreads, parentCommentId);
    state.update((s) => ({ ...s, comments: [reply, ...s.comments] }));
    this.adjustRepliesCount(postId, parentCommentId, 1);
  }

  /**
   * Content-only, no image — same simplification already accepted for editing a post (see
   * PostCard.saveEdit/PostsService.editPost, which don't support changing the image either).
   */
  async editComment(postId: string, commentId: string, parentCommentId: string | null, content: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<EditCommentApiResponse>(
        `${API_BASE_URL}/posts/${postId}/comments/${commentId}`,
        buildFormData({ content }),
      ),
    );
    this.patchComment(parentCommentId, postId, commentId, { content: response.data.comment.content });
  }

  async deleteComment(postId: string, commentId: string, parentCommentId: string | null): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_BASE_URL}/posts/${postId}/comments/${commentId}`));
    const map = parentCommentId ? this._replyThreads : this._threads;
    const key = parentCommentId ?? postId;
    const state = map.get(key);
    if (state) {
      state.update((s) => ({ ...s, comments: s.comments.filter((c) => c._id !== commentId) }));
    }
    if (parentCommentId) {
      this.adjustRepliesCount(postId, parentCommentId, -1);
    }
  }

  async toggleLike(postId: string, commentId: string, parentCommentId: string | null): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<CommentLikeToggleApiResponse>(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/like`, {}),
    );
    // Only `liked`/`likesCount` are trustworthy here — same reasoning as PostsService.toggleLike.
    this.patchComment(parentCommentId, postId, commentId, {
      likes: response.data.comment.likes,
      likesCount: response.data.likesCount,
    });
  }

  isLikedBy(comment: Comment, userId: string | undefined): boolean {
    return !!userId && comment.likes.includes(userId);
  }

  private fetchComments(postId: string, page: number) {
    const params = new HttpParams().set('page', page).set('limit', COMMENTS_PAGE_SIZE);
    return firstValueFrom(
      this.http.get<CommentsListApiResponse>(`${API_BASE_URL}/posts/${postId}/comments`, { params }),
    );
  }

  private fetchReplies(postId: string, commentId: string, page: number) {
    const params = new HttpParams().set('page', page).set('limit', COMMENTS_PAGE_SIZE);
    return firstValueFrom(
      this.http.get<RepliesListApiResponse>(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/replies`, {
        params,
      }),
    );
  }

  private mergePage(
    state: WritableSignal<CommentThreadState>,
    comments: Comment[],
    page: number,
    hasMore: boolean,
  ): void {
    state.update((s) => ({
      ...s,
      comments: page > 1 ? [...s.comments, ...comments] : comments,
      page,
      hasMore,
      hasFetched: true,
      isLoading: false,
      isLoadingMore: false,
      loadError: false,
      loadMoreError: false,
    }));
  }

  private patchComment(
    parentCommentId: string | null,
    postId: string,
    commentId: string,
    patch: Partial<Comment>,
  ): void {
    const map = parentCommentId ? this._replyThreads : this._threads;
    const key = parentCommentId ?? postId;
    const state = map.get(key);
    if (!state) {
      return;
    }
    state.update((s) => ({
      ...s,
      comments: s.comments.map((c) => (c._id === commentId ? { ...c, ...patch } : c)),
    }));
  }

  private adjustRepliesCount(postId: string, parentCommentId: string, delta: number): void {
    const state = this._threads.get(postId);
    if (!state) {
      return;
    }
    state.update((s) => ({
      ...s,
      comments: s.comments.map((c) =>
        c._id === parentCommentId ? { ...c, repliesCount: Math.max(0, c.repliesCount + delta) } : c,
      ),
    }));
  }

  private getOrCreate(
    map: Map<string, WritableSignal<CommentThreadState>>,
    key: string,
  ): WritableSignal<CommentThreadState> {
    let state = map.get(key);
    if (!state) {
      state = signal(initialThreadState());
      map.set(key, state);
    }
    return state;
  }
}

function toAuthor(author: CommentAuthor): CommentAuthor {
  return { _id: author._id, name: author.name, username: author.username, photo: author.photo };
}

function fromListItem(raw: CommentListItem): Comment {
  return {
    _id: raw._id,
    content: raw.content,
    image: raw.image,
    commentCreator: toAuthor(raw.commentCreator),
    post: raw.post,
    parentComment: raw.parentComment,
    likes: raw.likes,
    likesCount: raw.likes.length,
    repliesCount: raw.repliesCount,
    createdAt: raw.createdAt,
  };
}

/** A brand-new comment/reply has no replies yet — `repliesCount` defaults to 0, same reasoning as PostsService.toDisplayPost. */
function fromMutated(raw: MutatedComment): Comment {
  return {
    _id: raw._id,
    content: raw.content,
    image: raw.image,
    commentCreator: toAuthor(raw.commentCreator),
    post: raw.post,
    parentComment: raw.parentComment,
    likes: raw.likes,
    likesCount: raw.likesCount,
    repliesCount: 0,
    createdAt: raw.createdAt,
  };
}

function buildFormData(payload: CommentPayload): FormData {
  const formData = new FormData();
  if (payload.content) {
    formData.set('content', payload.content);
  }
  if (payload.image) {
    formData.set('image', payload.image);
  }
  return formData;
}
