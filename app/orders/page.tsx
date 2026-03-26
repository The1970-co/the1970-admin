import OrdersPageClient from "../orders-page-client";
import { getOrders } from "../../lib/orders-api";

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <main className="p-10">
      <OrdersPageClient initialOrders={orders} />
    </main>
  );
}