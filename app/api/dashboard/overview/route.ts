import { NextResponse } from "next/server";

const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4000";

type AnyObj = Record<string, any>;

async function getJson(path: string) {
  const res = await fetch(`${CORE_API_URL}${path}`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${path}`);
  }

  return res.json();
}

function toDateKey(input: unknown) {
  const value = String(input || "");
  return value.slice(0, 10);
}

function toDay(input: unknown) {
  const value = String(input || "");
  return value.slice(8, 10);
}

export async function GET() {
  try {
    const [ordersRaw, productsRaw] = await Promise.all([
      getJson("/orders").catch(() => []),
      getJson("/products").catch(() => []),
    ]);

    const orders = Array.isArray(ordersRaw) ? ordersRaw : ordersRaw?.data || [];
    const products = Array.isArray(productsRaw) ? productsRaw : productsRaw?.data || [];

    const todayKey = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const todayOrders = orders.filter((o: AnyObj) => toDateKey(o.createdAt) === todayKey);
    const yesterdayOrders = orders.filter((o: AnyObj) => toDateKey(o.createdAt) === yesterdayKey);

    const revenueToday = todayOrders.reduce((sum: number, o: AnyObj) => sum + Number(o.grandTotal || 0), 0);
    const revenueYesterday = yesterdayOrders.reduce((sum: number, o: AnyObj) => sum + Number(o.grandTotal || 0), 0);

    const ordersToday = todayOrders.length;
    const ordersYesterday = yesterdayOrders.length;

    const aovToday = ordersToday > 0 ? revenueToday / ordersToday : 0;
    const aovYesterday = ordersYesterday > 0 ? revenueYesterday / ordersYesterday : 0;

    const adSpendToday = 0;
    const adSpendYesterday = 0;

    const roasToday = adSpendToday > 0 ? revenueToday / adSpendToday : 0;
    const roasYesterday = adSpendYesterday > 0 ? revenueYesterday / adSpendYesterday : 0;

    const productMap = new Map<string, AnyObj>();
    for (const product of products) {
      productMap.set(String(product.id), product);
      if (product.name) productMap.set(String(product.name), product);
    }

    const costToday = todayOrders.reduce((sum: number, order: AnyObj) => {
      return (
        sum +
        (order.items || []).reduce((lineSum: number, item: AnyObj) => {
          const itemCost =
            Number(item.costPrice || 0) ||
            Number(item.unitCost || 0) ||
            0;
          return lineSum + Number(item.qty || 0) * itemCost;
        }, 0)
      );
    }, 0);

    const estimatedProfitToday = revenueToday - costToday - adSpendToday;

    const revenueByDayMap = new Map<
      string,
      { fullDate: string; revenue: number; orders: number; adSpend: number }
    >();

    for (const order of orders) {
      const fullDate = toDateKey(order.createdAt);
      const day = toDay(order.createdAt);
      if (!day || !fullDate) continue;

      const existing = revenueByDayMap.get(day) || {
        fullDate,
        revenue: 0,
        orders: 0,
        adSpend: 0,
      };

      existing.revenue += Number(order.grandTotal || 0);
      existing.orders += 1;

      revenueByDayMap.set(day, existing);
    }

    const revenueByDay = Array.from(revenueByDayMap.entries())
      .sort((a, b) => a[1].fullDate.localeCompare(b[1].fullDate))
      .slice(-30)
      .map(([day, item]) => ({
        day,
        fullDate: item.fullDate,
        revenue: item.revenue,
        orders: item.orders,
        roas: item.adSpend > 0 ? item.revenue / item.adSpend : 0,
        adSpend: item.adSpend,
      }));

    const topProductMap = new Map<
      string,
      { productId: string; name: string; sold: number; revenue: number; stockLeft: number; sku?: string }
    >();

    for (const order of todayOrders) {
      for (const item of order.items || []) {
        const key = String(item.productId || item.productName || item.sku);
        const linkedProduct =
          productMap.get(String(item.productId || "")) ||
          productMap.get(String(item.productName || ""));

        const stockLeft = linkedProduct
          ? (linkedProduct.variants || []).reduce(
              (sum: number, v: AnyObj) => sum + Number(v.stock || 0),
              0
            )
          : 0;

        const current = topProductMap.get(key) || {
          productId: String(item.productId || key),
          name: String(item.productName || key),
          sold: 0,
          revenue: 0,
          stockLeft,
          sku: item.sku ? String(item.sku) : undefined,
        };

        current.sold += Number(item.qty || 0);
        current.revenue += Number(item.lineTotal || item.unitPrice || 0) * Number(item.qty || 1);
        current.stockLeft = stockLeft;

        topProductMap.set(key, current);
      }
    }

    const topProducts = Array.from(topProductMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const channelMap = new Map<string, { value: number; orders: number }>();
    for (const order of todayOrders) {
      const key = String(order.salesChannel || "UNKNOWN");
      const current = channelMap.get(key) || { value: 0, orders: 0 };
      current.value += Number(order.grandTotal || 0);
      current.orders += 1;
      channelMap.set(key, current);
    }

    const channels = Array.from(channelMap.entries()).map(([name, item]) => ({
      name,
      value: item.value,
      percent: revenueToday > 0 ? Math.round((item.value / revenueToday) * 100) : 0,
      orders: item.orders,
    }));

    const branchLabels: Record<string, string> = {
      b1: "Hoàn Kiếm",
      b2: "Hai Bà Trưng",
      b3: "Online Warehouse",
    };

    const warehouseMap = new Map<string, { orders: number; revenue: number }>();
    for (const order of todayOrders) {
      const key = String(order.branchId || "unknown");
      const current = warehouseMap.get(key) || { orders: 0, revenue: 0 };
      current.orders += 1;
      current.revenue += Number(order.grandTotal || 0);
      warehouseMap.set(key, current);
    }

    const warehouses = Array.from(warehouseMap.entries()).map(([id, item]) => ({
      id,
      name: branchLabels[id] || id,
      orders: item.orders,
      revenue: item.revenue,
      stockRiskCount: topProducts.filter((p) => p.stockLeft <= 5).length,
    }));

    const alerts: DashboardOverview["alerts"] = [];

    if (ordersToday > 0 && revenueYesterday > 0 && revenueToday < revenueYesterday) {
      alerts.push({
        id: "checkout-warning",
        level: "warning",
        title: "Doanh thu giảm",
        description: "Doanh thu hôm nay đang thấp hơn hôm qua, cần xem checkout và ads.",
      });
    }

    if (topProducts.some((p) => p.stockLeft <= 5)) {
      alerts.push({
        id: "stock-warning",
        level: "warning",
        title: "SKU sắp hết",
        description: "Có sản phẩm bán tốt đang chạm ngưỡng tồn kho thấp.",
      });
    }

    if (!alerts.length) {
      alerts.push({
        id: "system-safe",
        level: "safe",
        title: "Hệ thống ổn",
        description: "Hiện chưa có cảnh báo lớn từ doanh thu và tồn kho.",
      });
    }

    const pct = (today: number, prev: number) => {
      if (!prev) return today > 0 ? 100 : 0;
      return ((today - prev) / prev) * 100;
    };

    return NextResponse.json({
      summary: {
        revenueToday,
        ordersToday,
        aovToday,
        adSpendToday,
        roasToday,
        estimatedProfitToday,
        compareRevenuePct: pct(revenueToday, revenueYesterday),
        compareOrdersPct: pct(ordersToday, ordersYesterday),
        compareAovPct: pct(aovToday, aovYesterday),
        compareRoasPct: pct(roasToday, roasYesterday),
        compareProfitPct: 0,
      },
      revenueByDay,
      topProducts,
      channels,
      warehouses,
      alerts,
      pendingApprovals: [
        {
          id: "apr-001",
          title: "Scale sản phẩm đang thắng",
          actionType: "scale15",
          reason: "Doanh thu tốt, SKU còn tồn",
          createdAt: new Date().toLocaleTimeString("vi-VN"),
        },
      ],
      actionLog: [
        {
          id: "log-001",
          time: new Date().toLocaleTimeString("vi-VN"),
          title: "Dashboard synced",
          detail: "Đã đồng bộ orders và products từ core API.",
        },
      ],
      metaConnection: {
        connected: true,
        mode: "dry_run",
        account: "act_2384_The1970",
        lastSync: new Date().toLocaleTimeString("vi-VN"),
        permissions: ["ads_read", "ads_management"],
      },
      scheduledTasks: [
        {
          id: "sch-1",
          time: "09:00",
          title: "Morning Risk Check",
          action: "auto_cut",
          note: "Kiểm tra risk buổi sáng",
        },
        {
          id: "sch-2",
          time: "20:00",
          title: "Evening Growth Check",
          action: "scale15",
          note: "Kiểm tra tăng trưởng buổi tối",
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Dashboard overview failed" },
      { status: 500 }
    );
  }
}