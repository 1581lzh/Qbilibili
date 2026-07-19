const AUTO_PLAY_KEY = "autoPlayVideo";
const HIGHLIGHT_COMMENT_KEY = "highlightComment";

/** Set the video ID to auto-play on next video page load. */
export function setAutoPlayVideo(videoId: string): void {
  try {
    sessionStorage.setItem(AUTO_PLAY_KEY, videoId);
  } catch {}
}

/**
 * Read and consume the auto-play video signal.
 * Returns the video ID if set, then removes the key.
 */
export function consumeAutoPlayVideo(): string | null {
  try {
    const id = sessionStorage.getItem(AUTO_PLAY_KEY);
    if (id) sessionStorage.removeItem(AUTO_PLAY_KEY);
    return id;
  } catch {
    return null;
  }
}

/** Set the comment ID to highlight on next video page load. */
export function setHighlightComment(commentId: string): void {
  try {
    sessionStorage.setItem(HIGHLIGHT_COMMENT_KEY, commentId);
  } catch {}
}

/**
 * Read and consume the highlight-comment signal.
 * Returns the comment ID if set, then removes the key.
 */
export function consumeHighlightComment(): string | null {
  try {
    const id = sessionStorage.getItem(HIGHLIGHT_COMMENT_KEY);
    if (id) sessionStorage.removeItem(HIGHLIGHT_COMMENT_KEY);
    return id;
  } catch {
    return null;
  }
}
