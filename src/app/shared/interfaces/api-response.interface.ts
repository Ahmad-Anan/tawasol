/**
 * Standard Route Posts API response envelope (see AGENTS.md and docs/api-reference.md).
 * Shared across features — previously duplicated in `features/auth/auth.interface.ts`,
 * moved here once `features/feed` needed the exact same envelope.
 */
export interface ApiSuccessResponse<TData> {
  success: true;
  message: string;
  data: TData;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  // Observed as both a plain string and an array of strings depending on the endpoint —
  // always type it `string | string[]` and handle both when reading it.
  errors: string | string[];
}
