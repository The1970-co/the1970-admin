"use client";

import { useEffect, useState } from "react";
import { createOrder, getProducts } from "../../lib/create-order-api";

type Product = {
  id: string;
  name: string;
  variants: any[];
};

export default function CreateOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [keyword, setKeyword] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  // filter search
  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(keyword.toLowerCase())
  );

  // add product
  function addItem(variant: any) {
    setCart((prev) => {
      const exist = prev.find((i) => i.variantId === variant.id);

      if (exist) {
        return prev.map((i) =>
          i.variantId === variant.id
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }

      return [
        ...prev,
        {
          variantId: variant.id,
          name: variant.product.name,
          sku: variant.sku,
          price: variant.priceVnd,
          qty: 1,
        },
      ];
    });
  }

  // tổng tiền
  const total = cart.reduce(
    (sum, i) => sum + i.price * i.qty,
    0
  );

  // tạo đơn
  async function handleCreateOrder() {
    try {
      setLoading(true);

      const payload = {
        note: "Created from admin",
        items: cart.map((i) => ({
          variantId: i.variantId,
          qty: i.qty,
        })),
      };

      const res = await createOrder(payload);

      alert("Tạo đơn thành công: " + res.orderCode);

      setCart([]);
    } catch (e) {
      console.error(e);
      alert("Tạo đơn lỗi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-10 grid grid-cols-12 gap-6">
      
      {/* LEFT */}
      <div className="col-span-7 space-y-4">
        <h2 className="text-2xl font-semibold">Tạo đơn</h2>

        <input
          className="border p-3 w-full rounded-xl"
          placeholder="Tìm sản phẩm..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <div className="space-y-2 max-h-[400px] overflow-auto">
          {filtered.map((p) =>
            p.variants.map((v: any) => (
              <button
                key={v.id}
                onClick={() => addItem({ ...v, product: p })}
                className="w-full text-left border p-3 rounded-xl hover:bg-gray-100"
              >
                {p.name} - {v.sku}
              </button>
            ))
          )}
        </div>

        {/* CART */}
        <div className="border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Sản phẩm trong đơn</h3>

          {cart.length === 0 && <div>Chưa có sản phẩm</div>}

          {cart.map((i) => (
            <div key={i.variantId} className="flex justify-between py-2">
              <div>
                {i.sku} x{i.qty}
              </div>
              <div>{(i.price * i.qty).toLocaleString()}đ</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="col-span-5">
        <div className="border rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4">Thanh toán</h3>

          <div className="flex justify-between py-2">
            <span>Tổng tiền</span>
            <span>{total.toLocaleString()}đ</span>
          </div>

          <button
            onClick={handleCreateOrder}
            disabled={loading || cart.length === 0}
            className="mt-6 w-full bg-black text-white py-3 rounded-xl"
          >
            {loading ? "Đang tạo..." : "Tạo đơn hàng"}
          </button>
        </div>
      </div>
    </div>
  );
}