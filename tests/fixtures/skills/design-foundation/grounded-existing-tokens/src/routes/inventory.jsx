const STOCK = [
  { name: "Blackberry jam", unit: "jar", onHand: 14, price: 7.5 },
  { name: "Free-range eggs", unit: "dozen", onHand: 6, price: 5.0 },
  { name: "Basil seedlings", unit: "pot", onHand: 22, price: 3.0 },
];

export default function InventoryPage() {
  return (
    <main>
      <h1>Inventory</h1>
      <p>Your stock on hand. Adjust counts after each market day.</p>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Unit</th>
            <th>On hand</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {STOCK.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.unit}</td>
              <td>{item.onHand}</td>
              <td>${item.price.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Items under 8 on hand are flagged low — restock before Saturday.</p>
    </main>
  );
}
