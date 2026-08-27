export function Cta({ onActivate }) {
  return (
    <button
      type="button"
      className="cta"
      style={{ color: '#7c3aed', background: '#a78bfa' }}
      onClick={onActivate}
    >
      Start a new draft
    </button>
  );
}
