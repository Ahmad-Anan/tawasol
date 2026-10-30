/** The like fields a post and a comment both carry. */
export interface LikeState {
  /** Ids of the users who liked it. */
  likes: string[];
  likesCount: number;
}

/** The optimistic flip of `userId`'s like, applied before the request goes out. */
export function toggledLike(state: LikeState, userId: string): LikeState {
  return state.likes.includes(userId)
    ? {
        likes: state.likes.filter((id) => id !== userId),
        likesCount: Math.max(0, state.likesCount - 1),
      }
    : { likes: [...state.likes, userId], likesCount: state.likesCount + 1 };
}

/**
 * The like fields once the server has answered. Only `liked` and `likesCount` from a like-toggle
 * response are trustworthy (docs/api-reference.md > PUT /posts/:id/like and PUT
 * /posts/:postId/comments/:commentId/like), so `liked` decides whether `userId` is in `likes` and
 * the server's count replaces the optimistic one, e.g. when someone else liked it meanwhile.
 */
export function reconciledLike(
  state: LikeState,
  userId: string,
  liked: boolean,
  likesCount: number,
): LikeState {
  const others = state.likes.filter((id) => id !== userId);
  return { likes: liked ? [...others, userId] : others, likesCount };
}
