const API_URL = "http://localhost:3000";

export async function getOrders() {
  const res = await fetch(`${API_URL}/orders`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch orders");
  }

  return res.json();
}

export async function getOrderById(id: string) {
  const res = await fetch(`${API_URL}/orders/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch order detail");
  }

  return res.json();
}

export async function updateOrderStatus(id: string, orderStatus: string) {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderStatus }),
  });

  if (!res.ok) {
    throw new Error("Failed to update order status");
  }

  return res.json();
}

export async function updatePaymentStatus(id: string, paymentStatus: string) {
  const res = await fetch(`${API_URL}/orders/${id}/payment-status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentStatus }),
  });

  if (!res.ok) {
    throw new Error("Failed to update payment status");
  }

  return res.json();
}

export async function createShipment(orderId: string) {
  const res = await fetch(`${API_URL}/shipments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      carrier: "GHN",
      trackingCode: `AUTO-${Date.now()}`,
      shippingFee: 30000,
      codAmount: 0,
      note: "Created from admin orders page",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to create shipment");
  }

  return res.json();
}