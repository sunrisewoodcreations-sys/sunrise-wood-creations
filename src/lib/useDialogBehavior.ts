import { useEffect, type RefObject } from "react";

// Makes a pop-up behave like a real dialog for keyboard and screen-reader
// users: focus moves into it when it opens, Escape closes it, Tab stays
// inside it, and focus goes back to the button that opened it when it
// closes. Visual styling is untouched.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogBehavior(open: boolean, onClose: () => void, containerRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const found = containerRef.current;
    if (!found) return;
    const container: HTMLElement = found;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] || container).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      // Focus can end up outside after the dialog's content changes (e.g. the
      // submit button it was on is replaced by a "sent" message).
      if (!container.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
    // onClose is intentionally not a dependency: callers pass an inline
    // function, and re-running this effect would steal focus on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, containerRef]);
}
