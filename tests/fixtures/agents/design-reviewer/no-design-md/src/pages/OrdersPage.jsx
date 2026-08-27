import './orders.css';

export function OrdersPage({ orders }) {
  return (
    <main className="orders-page">
      <h1>Open orders</h1>
      <ul className="orders-list">
        {orders.map((order) => (
          <li key={order.id} className="orders-row">
            <a className="orders-link" href={`/orders/${order.id}`}>
              {order.reference}
            </a>
            <span className="orders-total">{order.total}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
