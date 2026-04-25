"use client";

import { useState } from "react";
import PagePermissionGuard from "@/components/admin/PagePermissionGuard";
import AutopilotPage from "@/components/admin/AutopilotPage";
export default function AutopilotRoute() {
  const [adsMappings, setAdsMappings] = useState([
    {
      id: "m1",
      sku: "QS794-GREEN-S",
      productName: "QS794 Palm",
      campaignName: "QS794 Palm Conversion",
      campaignId: "cmp_1970_001",
      adsetName: "QS794 Green Core",
      adsetId: "adset_1970_001",
      channel: "FACEBOOK",
      status: "CONNECTED",
      spendToday: 850000,
      revenueToday: 2860000,
      roasToday: 3.36,
      budgetDaily: 1200000,
      lastAction: "Không có",
    },
    {
      id: "m2",
      sku: "SM902-REUDEN-M",
      productName: "SM902 Rêu Đen",
      campaignName: "SM902 Traffic to Purchase",
      campaignId: "cmp_1970_002",
      adsetName: "SM902 Broad",
      adsetId: "adset_1970_002",
      channel: "FACEBOOK",
      status: "CONNECTED",
      spendToday: 430000,
      revenueToday: 620000,
      roasToday: 1.44,
      budgetDaily: 800000,
      lastAction: "Giữ nguyên",
    },
    {
      id: "m3",
      sku: "HTB-TOBACCO-S",
      productName: "Heritage Tee Tobacco",
      campaignName: "Heritage Tee Launch",
      campaignId: "cmp_1970_003",
      adsetName: "Heritage Tee Interest",
      adsetId: "adset_1970_003",
      channel: "FACEBOOK",
      status: "NEEDS_MAPPING",
      spendToday: 0,
      revenueToday: 0,
      roasToday: 0,
      budgetDaily: 0,
      lastAction: "Chưa map",
    },
  ]);

  const pushActivity = (message: string) => {
    console.log("[AUTOPILOT]", message);
  };

return (
  <PagePermissionGuard permission="autopilot.view">
    <AutopilotPage
      mappings={adsMappings}
      setMappings={setAdsMappings}
      pushActivity={pushActivity}
    />
  </PagePermissionGuard>
);
}