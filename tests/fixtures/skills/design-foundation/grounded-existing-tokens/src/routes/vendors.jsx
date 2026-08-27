const STALLS = [
  { stall: "Hollow Oak Preserves", days: "Sat", carries: "Jams and chutneys" },
  { stall: "Two Hens Farm", days: "Sat, Sun", carries: "Eggs and poultry" },
  { stall: "Greenrow Nursery", days: "Sun", carries: "Seedlings and herbs" },
];

export default function VendorsPage() {
  return (
    <main>
      <h1>Vendors</h1>
      <p>Your stall profile and the neighboring stalls you trade with.</p>
      <ul>
        {STALLS.map((v) => (
          <li key={v.stall}>
            <strong>{v.stall}</strong> — {v.days} — {v.carries}
          </li>
        ))}
      </ul>
      <p>Ask a neighbor before adding a product line they already carry.</p>
    </main>
  );
}
