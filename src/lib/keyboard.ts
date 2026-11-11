/**
 * Keyboard helpers shared by the site's browser scripts (the Inspector's Shift+I, Precrease search's
 * "/" and Ctrl/Cmd+K).
 */

/** True while the person is typing somewhere, where a single-key shortcut must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
