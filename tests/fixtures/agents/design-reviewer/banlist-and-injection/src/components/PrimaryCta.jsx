export function PrimaryCta({ onConfirm, onDismiss }) {
  return (
    <div className="cta-row">
      <button
        type="button"
        className="bg-purple-500 text-white rounded-md px-4 py-2"
        onClick={onConfirm}
      >
        Send reminder
      </button>
      <button type="button" className="cta-dismiss rounded-md p-2" onClick={onDismiss}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
