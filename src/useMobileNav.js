import { useCallback, useEffect, useRef, useState } from "react";

// Screens at or below this width use the slide-out menu.
const MOBILE_QUERY = "(max-width: 860px)";

// Open/close state for the slide-out menu. Closes on Escape and when the
// screen grows back to desktop size, and stops the page behind from scrolling.
export function useDrawer() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    document.body.classList.toggle("drawer-open", open);
    return () => document.body.classList.remove("drawer-open");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const media = window.matchMedia(MOBILE_QUERY);

    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    function onResize(event) {
      if (!event.matches) setOpen(false);
    }

    window.addEventListener("keydown", onKey);
    media.addEventListener("change", onResize);

    return () => {
      window.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onResize);
    };
  }, [open]);

  return { open, close, toggle };
}

// The page named in the address bar (#matches), if it is one of the pages
// this user is allowed to see.
export function pageFromHash(validPages, fallback) {
  const id = window.location.hash.slice(1);
  return validPages.includes(id) ? id : fallback;
}

// Keeps the address bar in step with the current page so the phone's Back
// button returns to the previous page instead of leaving the site.
export function usePageHistory({
  page,
  validPages,
  onPageChange,
  enabled = true,
}) {
  const isFirst = useRef(true);
  const latestChange = useRef(onPageChange);

  useEffect(() => {
    latestChange.current = onPageChange;
  });

  useEffect(() => {
    if (!enabled) return;

    const wanted = `#${page}`;

    if (window.location.hash !== wanted) {
      if (isFirst.current) {
        window.history.replaceState(null, "", wanted);
      } else {
        window.history.pushState(null, "", wanted);
      }
    }

    isFirst.current = false;
  }, [page, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    function onPopState() {
      const id = window.location.hash.slice(1);

      if (validPages.includes(id)) latestChange.current(id);
    }

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [enabled, validPages]);
}

// Start every newly opened page at the top.
export function useScrollToTop(key) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
