import { useEffect, useRef } from 'react';
import './panel.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Panel({ open, title, children, onClose }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const first = panel.querySelector(FOCUSABLE);
    if (first) first.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = panel.querySelectorAll(FOCUSABLE);
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current) previouslyFocused.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <aside ref={panelRef} className="panel" role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel-accent" aria-hidden="true" />
      <header className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <button type="button" className="panel-close" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </aside>
  );
}
