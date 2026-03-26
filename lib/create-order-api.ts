const API_URL = "http://localhost:3000";

// lấy sản phẩm để search
export async function getProducts() {
  const res = await fetch(`${API_URL}/products`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Fetch products failed");

  return res.json();
}

// tạo đơn
export async function createOrder(data: any) {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Create order failed");

  return res.json();
}