import type {
  PrintPaperSize,
  PrintTemplateConfig,
} from "@/lib/print-template-config";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0)) + "đ";
}

function escapeHtml(value: string) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseStructuredNote(note?: string) {
  if (!note) {
    return {
      noteText: "",
      address: "",
      shippingMode: "",
      shippingPartner: "",
      shippingNote: "",
    };
  }

  const parts = note
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);

  const getValue = (prefix: string) => {
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? found.replace(prefix, "").trim() : "";
  };

  return {
    noteText: getValue("Ghi chú:"),
    address: getValue("Địa chỉ:"),
    shippingMode: getValue("Cách giao:"),
    shippingPartner: getValue("Đơn vị giao:"),
    shippingNote: getValue("Ghi chú giao hàng:"),
  };
}

function barcodeUrl(data: string) {
  // showhrt/hidehrt dùng để tắt dòng chữ nhỏ tự sinh dưới barcode.
  // Một số trình sinh barcode có thể bỏ qua tham số này, nên phía render còn crop phần đáy ảnh thêm 1 lớp.
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    data || "EMPTY",
  )}&code=Code128&dpi=96&showhrt=false&hidehrt=true`;
}

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    data || "EMPTY",
  )}`;
}

function replaceAllTokens(template: string, data: Record<string, string>) {
  let html = template;
  Object.entries(data).forEach(([key, value]) => {
    html = html.replaceAll(`{{${key}}}`, value);
  });
  return html;
}

function getCleanPrintItemName(item: any) {
  const productName =
    item?.productName ||
    item?.product?.name ||
    item?.variant?.product?.name ||
    item?.name ||
    item?.variantName ||
    "Sản phẩm";

  const size = getItemSize(item);
  const color = getItemColor(item);

  return [productName, size ? `Size ${size}` : "", color ? `Màu ${color}` : ""]
    .filter(Boolean)
    .join(" - ");
}

function buildItemsRows(order: any, type: string) {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (!items.length) {
    return `<tr><td colspan="${type === "sales" ? 4 : 2}" style="padding:4px 0;color:#777;">Chưa có dữ liệu sản phẩm</td></tr>`;
  }

  if (type === "sales") {
    return items
      .map((item: any) =>
        `
<tr>
  <td style="padding:4px 0; border-bottom:1px dashed #ddd;">
    ${escapeHtml(getItemName(item))}
    <div style="font-size:10px; color:#666;">
      ${escapeHtml(getItemSku(item))}
      ${getItemColor(item) ? ` · ${escapeHtml(getItemColor(item))}` : ""}
      ${getItemSize(item) ? ` / ${escapeHtml(getItemSize(item))}` : ""}
    </div>
  </td>
  <td style="padding:4px 0; text-align:center; border-bottom:1px dashed #ddd;">${getItemQty(item)}</td>
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(getItemUnitPrice(item))}</td>
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(getItemLineTotal(item))}</td>
</tr>
        `.trim(),
      )
      .join("");
  }

  return items
    .map((item: any) =>
      `
<tr>
  <td style="padding:2px 0; border-bottom:1px dashed #ddd;">
    <div style="font-size:11px;font-weight:600;line-height:1.2;">
      ${escapeHtml(getCleanPrintItemName(item))}
    </div>
  </td>
  <td style="padding:2px 0; text-align:center; border-bottom:1px dashed #ddd;">${getItemQty(item)}</td>
</tr>
      `.trim(),
    )
    .join("");
}

function templateFieldVisible(
  template: PrintTemplateConfig,
  key:
    | "showOrderCode"
    | "showCreatedAt"
    | "showCustomerName"
    | "showCustomerPhone"
    | "showShippingAddress"
    | "showItems"
    | "showItemQty"
    | "showFooter",
) {
  return (template as any)?.[key] !== false;
}

function buildItemsRowsForPrint(order: any, type: string, showQty = true) {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (!items.length) {
    return `<tr><td colspan="${showQty ? 2 : 1}" style="padding:4px 0;color:#777;">Chưa có dữ liệu sản phẩm</td></tr>`;
  }

  if (type === "sales") {
    return items
      .map((item: any) => {
        const name = escapeHtml(getItemName(item));
        const sku = escapeHtml(getItemSku(item));
        const color = getItemColor(item)
          ? ` · ${escapeHtml(getItemColor(item))}`
          : "";
        const size = getItemSize(item)
          ? ` / ${escapeHtml(getItemSize(item))}`
          : "";
        return `
<tr>
  <td style="padding:4px 0; border-bottom:1px dashed #ddd;">
    ${name}
    <div style="font-size:10px; color:#666;">${sku}${color}${size}</div>
  </td>
  ${showQty ? `<td style="padding:4px 0; text-align:center; border-bottom:1px dashed #ddd;">${getItemQty(item)}</td>` : ""}
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(getItemUnitPrice(item))}</td>
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(getItemLineTotal(item))}</td>
</tr>`.trim();
      })
      .join("");
  }

  return items
    .map((item: any) =>
      `
<tr>
  <td style="padding:2px 0; border-bottom:1px dashed #ddd;">
    <div style="font-size:11px;font-weight:600;line-height:1.2;">
      ${escapeHtml(getCleanPrintItemName(item))}
    </div>
  </td>
  ${showQty ? `<td style="padding:2px 0; text-align:center; border-bottom:1px dashed #ddd;">${getItemQty(item)}</td>` : ""}
</tr>
      `.trim(),
    )
    .join("");
}

function normalizeTextForCompare(value: any) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,.，、;:]+/g, " ")
    .trim();
}

function stripPhoneNoiseFromAddress(value: any) {
  let text = String(value || "");

  text = text.replace(
    /([,;.\s]|^)(đt|dt|sđt|sdt|phone|tel|điện thoại)\s*[:.]?\s*0\d{8,11}.*$/gi,
    "",
  );

  text = text.replace(/[,\s]*0\d{8,11}.*$/g, "");

  return text
    .replace(/\bĐịa chỉ\s*:\s*/gi, "")
    .replace(/\bDia chi\s*:\s*/gi, "")
    .replace(/\bAddress\s*:\s*/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function cleanAddressText(value: any) {
  let text = stripPhoneNoiseFromAddress(value)
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .trim();

  text = text
    .replace(/\bĐịa chỉ\s*:\s*/gi, "")
    .replace(/\bDia chi\s*:\s*/gi, "")
    .replace(/\bAddress\s*:\s*/gi, "")
    .trim();

  const parts = text
    .split(",")
    .map((part) => stripPhoneNoiseFromAddress(part).trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const key = normalizeTextForCompare(part);
    if (!key || seen.has(key)) continue;

    if (/^(dt|đt|sdt|sđt|phone|tel)$/i.test(key)) continue;

    seen.add(key);
    unique.push(part);
  }

  return unique.join(", ");
}

function pickPureShippingAddress(order: any) {
  // Chỉ lấy trường địa chỉ giao hàng thuần.
  // Không lấy note/ghi chú/formatted address từ hãng vận chuyển.
  const candidates = [
    order?.shippingAddressLine1,
    order?.shippingAddressLine,
    order?.addressLine1,
    order?.receiverAddress,
    order?.recipientAddress,
    order?.shippingStreet,
  ];

  for (const value of candidates) {
    const text = String(value || "").trim();
    if (!text) continue;
    if (/ghi chú|note|hàng tặng|ship|cod/i.test(text)) continue;
    return text;
  }

  return "";
}

function buildShippingNote(order: any) {
  const raw =
    order?.shippingNote || order?.deliveryNote || order?.noteForCarrier || "";

  const note = String(raw || "").trim();
  if (!note) return "";
  if (/^\s*(địa chỉ|dia chi|address)\s*:/i.test(note)) return "";

  return note;
}

function buildShippingAddress(order: any, fallbackAddress = "") {
  const full = [
    order?.shippingAddressLine1,
    order?.shippingAddressLine2,
    order?.shippingWard,
    order?.shippingDistrict,
    order?.shippingProvince,
    order?.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return full || fallbackAddress || "";
}

function normalizeTrackingCode(order: any) {
  const raw =
    order?.shipment?.trackingCode ||
    order?.shipment?.orderCode ||
    order?.shipment?.shippingOrderCode ||
    order?.shipment?.waybillCode ||
    "";

  const code = String(raw || "").trim();
  if (!code || code === "NO-GHN-CODE") return "";
  return code;
}


function parseMaybeJson(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isLikelyGhnSortCode(value: any) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return false;
  if (text.length < 4 || text.length > 40) return false;

  // Ví dụ GHN: HY-200-K-02-A3, C-100-Q-04-B4.
  // Không lấy mã vận đơn/tracking vì mã vận đơn đã in ở barcode riêng.
  return /^[A-Z0-9]+(?:-[A-Z0-9]+){1,6}$/.test(text);
}

function findGhnSortCodeInObject(input: any, depth = 0): string {
  if (!input || depth > 5) return "";

  const obj = parseMaybeJson(input) || input;
  if (!obj || typeof obj !== "object") return "";

  const directKeys = [
    "sort_code",
    "sorting_code",
    "sortCode",
    "sortingCode",
    "route_code",
    "routing_code",
    "routeCode",
    "routingCode",
    "warehouse_code",
    "warehouseCode",
    "hub_code",
    "hubCode",
    "delivery_sort_code",
    "deliverySortCode",
    "ward_encode",
    "wardEncode",
    "area_code",
    "areaCode",
  ];

  for (const key of directKeys) {
    const value = obj?.[key];
    if (isLikelyGhnSortCode(value)) return String(value).trim().toUpperCase();
  }

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const shouldScanValue =
      lowerKey.includes("sort") ||
      lowerKey.includes("route") ||
      lowerKey.includes("routing") ||
      lowerKey.includes("warehouse") ||
      lowerKey.includes("hub") ||
      lowerKey.includes("ward_encode") ||
      lowerKey.includes("area");

    if (shouldScanValue && isLikelyGhnSortCode(value)) {
      return String(value).trim().toUpperCase();
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findGhnSortCodeInObject(value, depth + 1);
      if (found) return found;
    }
  }

  return "";
}

function getGhnSortCode(order: any) {
  const shipment = order?.shipment || {};
  const metadata = parseMaybeJson(shipment?.metadata) || shipment?.metadata || {};
  const shipmentRaw = parseMaybeJson(shipment?.raw) || shipment?.raw || {};
  const orderMetadata = parseMaybeJson(order?.metadata) || order?.metadata || {};

  const sources = [
    shipment?.ghnSortCode,
    shipment?.sortCode,
    shipment?.sortingCode,
    shipment?.routingCode,
    shipment?.routeCode,
    shipment?.wardEncode,
    metadata,
    shipmentRaw,
    shipment,
    order?.ghn,
    order?.ghnRaw,
    orderMetadata,
  ];

  for (const source of sources) {
    if (isLikelyGhnSortCode(source)) return String(source).trim().toUpperCase();
    const found = findGhnSortCodeInObject(source);
    if (found) return found;
  }

  return "";
}


function getGhnRequiredNoteLabel(order: any) {
  const shipment = order?.shipment || {};
  const metadata = parseMaybeJson(shipment?.metadata) || shipment?.metadata || {};
  const rawValue =
    shipment?.requiredNote ||
    shipment?.required_note ||
    metadata?.required_note ||
    metadata?.requiredNote ||
    metadata?.requestPayload?.required_note ||
    metadata?.requestPayload?.requiredNote ||
    metadata?.payload?.required_note ||
    metadata?.rawPayload?.required_note ||
    order?.requiredNote ||
    order?.required_note ||
    "";

  const value = String(rawValue || "").trim().toUpperCase();
  if (!value) return "";

  if (value.includes("CHOXEMHANGKHONGTHU") || value.includes("CHO_XEM_HANG_KHONG_THU")) {
    return "CHO XEM HÀNG, KHÔNG CHO THỬ";
  }

  if (value.includes("CHOTHUHANG") || value.includes("CHO_THU_HANG")) {
    return "CHO THỬ HÀNG";
  }

  if (value.includes("KHONGCHOXEMHANG") || value.includes("KHONG_CHO_XEM_HANG")) {
    return "KHÔNG CHO XEM HÀNG";
  }

  return value.replaceAll("_", " ");
}

function buildGhnSortCodeBlock(sortCode: string, compact = true) {
  const code = String(sortCode || "").trim().toUpperCase();
  if (!code) return "";

  return compact
    ? `<div data-ghn-sort-code="1" style="margin:1.2mm 0 1.4mm;border-top:1px dashed #111;border-bottom:1px dashed #111;text-align:center;font-size:16px;font-weight:900;letter-spacing:.7px;line-height:1.05;padding:1mm 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(code)}</div>`
    : `<div data-ghn-sort-code="1" style="margin:8px 0;border-top:1px dashed #111;border-bottom:1px dashed #111;text-align:center;font-size:28px;font-weight:900;letter-spacing:1px;line-height:1.1;padding:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(code)}</div>`;
}

function displayPrintOrderCode(order: any) {
  const trackingCode = normalizeTrackingCode(order);

  const raw =
    order?.externalOrderCode ||
    order?.customerOrderCode ||
    order?.referenceCode ||
    order?.shipment?.clientOrderCode ||
    order?.shipment?.trackingCode ||
    trackingCode ||
    "";

  const code = String(raw || "").trim();

  if (!code || code.toUpperCase().startsWith("ORD-")) return trackingCode || "";

  return code;
}

function getItemName(item: any) {
  return (
    item?.productName ||
    item?.name ||
    item?.product?.name ||
    item?.variant?.product?.name ||
    item?.variantName ||
    "Sản phẩm"
  );
}

function getItemSku(item: any) {
  return item?.sku || item?.variant?.sku || "";
}

function looksLikeSize(value: any) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (!text) return false;

  return (
    /^(XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL|5XL)$/.test(text) ||
    /^(2[6-9]|3[0-9]|4[0-8])$/.test(text) ||
    /^(28|29|30|31|32|33|34|35|36|38|40|42)$/.test(text)
  );
}

function resolveItemSizeColor(item: any) {
  let size = String(item?.size || item?.variant?.size || "").trim();
  let color = String(item?.color || item?.variant?.color || "").trim();

  // Một số order/variant cũ bị map ngược attribute: size=THAN, color=M.
  // Nếu màu đang là size thật còn size không giống size, tự đảo lại trước khi in.
  if (color && size && looksLikeSize(color) && !looksLikeSize(size)) {
    return { size: color, color: size };
  }

  return { size, color };
}

function getItemColor(item: any) {
  return resolveItemSizeColor(item).color;
}

function getItemSize(item: any) {
  return resolveItemSizeColor(item).size;
}

function getItemQty(item: any) {
  return Number(item?.qty ?? item?.quantity ?? item?.quantityOrdered ?? 0);
}

function getItemUnitPrice(item: any) {
  return Number(item?.unitPrice ?? item?.price ?? item?.salePrice ?? 0);
}

function getItemLineTotal(item: any) {
  return Number(
    item?.lineTotal ?? item?.total ?? getItemQty(item) * getItemUnitPrice(item),
  );
}

function shortenNote(value?: string, max = 140) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildCleanNote(
  order: any,
  meta: ReturnType<typeof parseStructuredNote>,
) {
  const preferred = meta.shippingNote || meta.noteText || "";
  if (preferred) return shortenNote(preferred, 140);

  const raw = String(order?.note || "").trim();
  if (!raw) return "";

  // Nếu là metadata dài kiểu "CustomerId: ... | Giảm giá: ..."
  // thì không in ra để tránh bẩn mẫu phiếu.
  const looksLikeSystemMeta =
    raw.includes("CustomerId:") ||
    raw.includes("CustomerAddressId:") ||
    raw.includes("Kiểu vận chuyển UI:") ||
    raw.includes("GHN ServiceId:") ||
    raw.includes("GHN DistrictId:") ||
    raw.includes("GHN WardCode:") ||
    raw.includes("Kích thước:");

  if (looksLikeSystemMeta) return "";

  return shortenNote(raw, 140);
}

function buildShippingTemplateHtml(params: {
  template: PrintTemplateConfig;
  data: Record<string, string>;
  trackingCode: string;
  noteValue: string;
  itemCount: number;
  ghnSortCode?: string;
}) {
  const { template, data, trackingCode, noteValue, itemCount, ghnSortCode = "" } = params;
  const hasTracking = Boolean(trackingCode);
  const isSquare80 = template.paperSize === "80mm";
  const ghnSortCodeBlock = buildGhnSortCodeBlock(ghnSortCode, isSquare80);
  const squareItemsTop = ghnSortCodeBlock ? "40mm" : "33mm";

  if (isSquare80) {
    return `
<div style="width:80mm;height:80mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:9.6px;line-height:1.08;padding:2.2mm 2.5mm;border:1px solid #111;overflow:hidden;position:relative;">
  <div style="text-align:center;margin:0 0 2px 0;">
    <div style="font-size:14px;font-weight:900;letter-spacing:.5px;line-height:1;">${data.storeName}</div>
    <div style="font-size:11px;font-weight:900;letter-spacing:.1px;margin-top:1px;">${data.title || "PHIẾU GIAO HÀNG"}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:start;margin-bottom:2px;font-size:8.8px;border-bottom:1px dashed #999;padding-bottom:2px;">
    <div><b>Mã đơn:</b> ${data.orderCode || trackingCode || "—"}</div>
    <div style="text-align:right;"><b>Ngày tạo:</b> ${data.createdAt}</div>
  </div>

  <div style="font-size:9.5px;margin-bottom:2px;">
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b>Người nhận:</b> ${data.customerName}</div>
    <div><b>SĐT:</b> ${data.customerPhone}</div>
    <div style="height:22px;overflow:hidden;"><b>Đ/C:</b> ${data.shippingAddress}</div>
  </div>

  ${data.financialBlock || ""}
  ${ghnSortCodeBlock}

  <div style="position:absolute;left:2.5mm;right:2.5mm;top:${squareItemsTop};bottom:17mm;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:9.3px;line-height:1.05;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">Sản phẩm</th>
          <th style="text-align:center;width:17px;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">SL</th>
        </tr>
      </thead>
      <tbody>${data.itemsRows}</tbody>
    </table>
  </div>

 <div style="position:absolute;left:2.5mm;right:2.5mm;bottom:8mm;height:13mm;border-top:1px solid #111;padding-top:1mm;display:grid;grid-template-columns:1fr 15mm;gap:5mm;align-items:center;">
    <div style="text-align:center;">
      ${
        hasTracking && template.showBarcode
          ? `<img src="${barcodeUrl(trackingCode)}" style="width:30mm;height:12mm;object-fit:contain;display:block;margin:0 auto;" />`
          : ""
      }
    </div>
    <div style="text-align:center;">
      ${
        hasTracking && template.showQr
          ? `<img src="${qrUrl(trackingCode)}" style="width:13mm;height:13mm;object-fit:contain;display:block;margin:0 auto;" />`
          : ""
      }
    </div>
  </div>

</div>
    `.trim();
  }

  return `
<div style="width:72mm;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;line-height:1.35;padding:2mm 2mm 4mm;">
  <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px;">
    <div style="font-size:18px;font-weight:700;letter-spacing:.4px;">${data.storeName}</div>
    ${data.storeAddress ? `<div style="font-size:11px;margin-top:2px;">${data.storeAddress}</div>` : ""}
  </div>

  <div style="text-align:center;font-size:20px;font-weight:700;margin-bottom:8px;">PHIẾU GIAO HÀNG</div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="vertical-align:top;font-size:11px;"><div><strong>Mã đơn:</strong> ${data.orderCode || trackingCode || "—"}</div></td>
      <td style="vertical-align:top;text-align:right;font-size:11px;"><div><strong>Ngày tạo:</strong> ${data.createdAt}</div></td>
    </tr>
  </table>

  <div style="margin-bottom:8px;">
    <div><strong>Người nhận:</strong> ${data.customerName}</div>
    <div style="margin-top:2px;"><strong>SĐT:</strong> ${data.customerPhone}</div>
    <div style="margin-top:2px;"><strong>Đ/C:</strong> ${data.shippingAddress}</div>
  </div>

  ${noteValue ? `<div style="border:1px dashed #999;padding:5px 6px;margin-bottom:8px;"><div style="font-weight:700;margin-bottom:2px;">Ghi chú</div><div>${escapeHtml(noteValue)}</div></div>` : ""}

  ${data.financialBlock || ""}
  ${ghnSortCodeBlock}

  <div style="border-top:1px dashed #999;border-bottom:1px dashed #999;padding:6px 0;margin-bottom:8px;">
    <div style="font-weight:700;margin-bottom:4px;">Sản phẩm</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="text-align:left;font-size:11px;padding-bottom:4px;">Sản phẩm</th><th style="text-align:right;font-size:11px;padding-bottom:4px;">SL</th></tr></thead>
      <tbody>${data.itemsRows}</tbody>
    </table>
  </div>

  ${
    hasTracking && template.showBarcode
      ? `<div style="text-align:center;margin:10px 0 6px;"><img src="${barcodeUrl(trackingCode)}" style="max-width:100%;height:72px;object-fit:contain;" /></div>`
      : ""
  }

  ${
    hasTracking && template.showQr
      ? `<div style="text-align:center;margin-top:6px;"><img src="${qrUrl(trackingCode)}" style="width:96px;height:96px;object-fit:contain;" /></div>`
      : ""
  }

</div>
  `.trim();
}

function buildSalesTemplateHtml(params: {
  template: PrintTemplateConfig;
  data: Record<string, string>;
}) {
  const { data } = params;

  return `
<div style="width:72mm;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;line-height:1.35;padding:2mm 2mm 4mm;">
  <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px;">
    <div style="font-size:18px;font-weight:700;letter-spacing:.4px;">
      ${data.storeName}
    </div>
    ${
      data.storeAddress
        ? `<div style="font-size:11px;margin-top:2px;">${data.storeAddress}</div>`
        : ""
    }
  </div>

  <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:8px;">
    PHIẾU BÁN HÀNG
  </div>

  <div style="margin-bottom:8px;">
    <div><strong>Mã đơn:</strong> ${data.orderCode}</div>
    <div><strong>Ngày tạo:</strong> ${data.createdAt}</div>
    <div><strong>Khách hàng:</strong> ${data.customerName}</div>
    <div><strong>SĐT:</strong> ${data.customerPhone}</div>
  </div>

  <div style="border-top:1px dashed #999;border-bottom:1px dashed #999;padding:6px 0;margin-bottom:8px;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;padding-bottom:4px;">Sản phẩm</th>
          <th style="text-align:center;font-size:11px;padding-bottom:4px;">SL</th>
          <th style="text-align:right;font-size:11px;padding-bottom:4px;">Đơn giá</th>
          <th style="text-align:right;font-size:11px;padding-bottom:4px;">TT</th>
        </tr>
      </thead>
      <tbody>
        ${data.itemsRows}
      </tbody>
    </table>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:6px;">
    <tr>
      <td style="padding:2px 0;">Tạm tính</td>
      <td style="padding:2px 0;text-align:right;">${data.subtotal}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;">Phí ship</td>
      <td style="padding:2px 0;text-align:right;">${data.shippingFee || "0đ"}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;font-weight:700;">Khách phải trả</td>
      <td style="padding:2px 0;text-align:right;font-weight:700;">${data.finalAmount}</td>
    </tr>
  </table>

  ${
    data.note
      ? `
    <div style="margin-top:8px;border-top:1px dashed #999;padding-top:6px;">
      <div><strong>Ghi chú:</strong> ${data.note}</div>
    </div>
  `
      : ""
  }

</div>
  `.trim();
}

export type ProductLabelPrintItem = {
  productName?: string;
  name?: string;
  sku?: string;
  variantSku?: string;
  barcode?: string;
  size?: string;
  color?: string;
  price?: number;
  salePrice?: number;
  finalPrice?: number;
  qrValue?: string;
  quantity?: number;
  qty?: number;
  variant?: {
    sku?: string;
    size?: string;
    color?: string;
    price?: number;
    salePrice?: number;
    barcode?: string;
    product?: { name?: string };
  };
  product?: { name?: string };
};

export type ProductLabelPrintOptions = {
  gapMm?: number;
  scale?: number;
  paperWidthMm?: number;
  paperHeightMm?: number;
  showProductName?: boolean;
  showBarcode?: boolean;
  showSku?: boolean;
  showSize?: boolean;
  showColor?: boolean;
  showPrice?: boolean;
  showQr?: boolean;
  showWebsite?: boolean;
  showRecycle?: boolean;
  showMadeInVietnam?: boolean;
  barcodeWidthMm?: number;
  barcodeHeightMm?: number;
  qrSizeMm?: number;
};

function normalizeLabelOptions(options?: ProductLabelPrintOptions) {
  return {
    gapMm: Number.isFinite(Number(options?.gapMm))
      ? Number(options?.gapMm)
      : 0.4,
    scale: Number.isFinite(Number(options?.scale))
      ? Number(options?.scale)
      : 100,
    paperWidthMm: Number.isFinite(Number(options?.paperWidthMm))
      ? Number(options?.paperWidthMm)
      : 50,
    paperHeightMm: Number.isFinite(Number(options?.paperHeightMm))
      ? Number(options?.paperHeightMm)
      : 50,
    showProductName: options?.showProductName !== false,
    showBarcode: options?.showBarcode !== false,
    showSku: options?.showSku !== false,
    showSize: options?.showSize !== false,
    showColor: options?.showColor !== false,
    showPrice: options?.showPrice !== false,
    showQr: options?.showQr !== false,
    showWebsite: options?.showWebsite !== false,
    showRecycle: options?.showRecycle !== false,
    showMadeInVietnam: options?.showMadeInVietnam !== false,
    barcodeWidthMm: Number.isFinite(Number(options?.barcodeWidthMm))
      ? Number(options?.barcodeWidthMm)
      : 47,
    barcodeHeightMm: Number.isFinite(Number(options?.barcodeHeightMm))
      ? Number(options?.barcodeHeightMm)
      : 10.2,
    qrSizeMm: Number.isFinite(Number(options?.qrSizeMm))
      ? Number(options?.qrSizeMm)
      : 13,
  };
}

function formatLabelPrice(value: any) {
  const amount = Number(value || 0);
  if (!amount) return "";
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

function getProductLabelName(item: ProductLabelPrintItem) {
  return (
    item?.productName ||
    item?.name ||
    item?.product?.name ||
    item?.variant?.product?.name ||
    "Sản phẩm"
  );
}

function getProductLabelSku(item: ProductLabelPrintItem) {
  return (
    item?.sku || item?.variantSku || item?.variant?.sku || item?.barcode || ""
  );
}

function getProductLabelSize(item: ProductLabelPrintItem) {
  return item?.size || item?.variant?.size || "";
}

function getProductLabelColor(item: ProductLabelPrintItem) {
  return item?.color || item?.variant?.color || "";
}

function getProductLabelPrice(item: ProductLabelPrintItem) {
  return (
    item?.price ??
    item?.salePrice ??
    item?.finalPrice ??
    item?.variant?.price ??
    item?.variant?.salePrice ??
    0
  );
}

function getProductLabelQty(item: ProductLabelPrintItem) {
  const qty = Number(item?.quantity ?? item?.qty ?? 1);
  return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;
}

function buildProductLabelData(item: ProductLabelPrintItem) {
  const sku = getProductLabelSku(item);
  const qrValue = item?.qrValue || sku;

  return {
    productName: escapeHtml(getProductLabelName(item)),
    sku: escapeHtml(sku),
    size: escapeHtml(getProductLabelSize(item)),
    color: escapeHtml(getProductLabelColor(item)),
    price: escapeHtml(formatLabelPrice(getProductLabelPrice(item))),
    barcodeValue: sku || "EMPTY",
    qrValue: qrValue || sku || "EMPTY",
  };
}

export function renderProductLabelTemplateHtml(params: {
  item: ProductLabelPrintItem;
  template?: PrintTemplateConfig | null;
  options?: ProductLabelPrintOptions;
}) {
  const { item, template, options } = params;
  const labelOptions = normalizeLabelOptions(options);
  const data = buildProductLabelData(item);

  const defaultHtml = `
<div style="width:50mm;height:50mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#111;font-family:Arial,sans-serif;border:1px solid #777;border-radius:1.4mm;overflow:hidden;position:relative;padding:1.2mm;">
  <div style="display:grid;grid-template-columns:1fr 5mm 1fr;align-items:center;font-size:5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;height:4.6mm;border-bottom:1px solid #999;">
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{websiteText}}</div>
    <div style="text-align:center;font-size:10px;line-height:1;">{{recycleText}}</div>
    <div style="text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{madeInText}}</div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;top:6mm;height:17mm;text-align:center;border-left:1px solid #999;border-right:1px solid #999;">
    <div style="font-size:8px;font-weight:900;line-height:1.1;height:4.2mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 .8mm;">{{productName}}</div>
    <div style="height:9.8mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">{{barcodeBlock}}</div>
    <div style="font-size:10px;font-weight:900;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{sku}}</div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;top:23mm;height:17.2mm;border:1px solid #999;display:grid;grid-template-columns:10mm 1fr 17mm;grid-template-rows:8.6mm 8.6mm;">
    <div style="border-right:1px solid #999;border-bottom:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">CỠ</div>
    <div style="border-right:1px solid #999;border-bottom:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;">{{size}}</div>
    <div style="grid-row:1 / span 2;grid-column:3;border-left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5mm;overflow:hidden;">{{qrBlock}}<div style="font-size:6px;font-weight:900;line-height:1;white-space:nowrap;max-width:15mm;overflow:hidden;text-overflow:ellipsis;">{{sku}}</div></div>
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">MÀU</div>
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 .8mm;">{{color}}</div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;bottom:1.2mm;height:8.6mm;border:1px solid #999;display:grid;grid-template-columns:10mm 1fr;">
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">GIÁ</div>
    <div style="display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;letter-spacing:.2px;white-space:nowrap;overflow:hidden;">{{price}}</div>
  </div>
</div>
`.trim();

  const html = (template?.templateHtml || defaultHtml).replace(
    /width:50mm;height:50mm;/,
    `width:${labelOptions.paperWidthMm}mm;height:${labelOptions.paperHeightMm}mm;`,
  );

  return replaceAllTokens(html, {
    websiteText: labelOptions.showWebsite ? "THE 1970.VN®" : "",
    recycleText: labelOptions.showRecycle ? "♻" : "",
    madeInText: labelOptions.showMadeInVietnam ? "MADE IN VIETNAM" : "",
    productName: labelOptions.showProductName ? data.productName : "",
    sku: labelOptions.showSku ? data.sku : "",
    size: labelOptions.showSize ? data.size : "",
    color: labelOptions.showColor ? data.color : "",
    price: labelOptions.showPrice ? data.price : "",
    barcodeValue: escapeHtml(data.barcodeValue),
    qrValue: escapeHtml(data.qrValue),
    barcodeBlock:
      template?.showBarcode === false || !labelOptions.showBarcode
        ? ""
        : `<div style="width:${labelOptions.barcodeWidthMm}mm;height:${labelOptions.barcodeHeightMm}mm;overflow:hidden;display:flex;align-items:flex-start;justify-content:center;margin:0 auto;"><img src="${barcodeUrl(data.barcodeValue)}" style="width:${labelOptions.barcodeWidthMm}mm;height:${labelOptions.barcodeHeightMm + 6}mm;object-fit:fill;display:block;margin:0 auto;transform:translateY(-1.6mm);" /></div>`,
    qrBlock:
      template?.showQr === false || !labelOptions.showQr
        ? ""
        : `<img src="${qrUrl(data.qrValue)}" style="width:${labelOptions.qrSizeMm}mm;height:${labelOptions.qrSizeMm}mm;object-fit:contain;display:block;margin:0 auto;" />`,
  });
}

export function renderProductLabelsHtml(params: {
  items: ProductLabelPrintItem[];
  template?: PrintTemplateConfig | null;
  options?: ProductLabelPrintOptions;
}) {
  const { items, template, options } = params;
  const pages: string[] = [];

  items.forEach((item) => {
    const qty = getProductLabelQty(item);
    for (let index = 0; index < qty; index += 1) {
      pages.push(
        `<div class="print-page"><div class="print-page-inner">${renderProductLabelTemplateHtml({ item, template, options })}</div></div>`,
      );
    }
  });

  return pages.join("\n");
}

export function openProductLabelPrintDocument(params: {
  title?: string;
  items: ProductLabelPrintItem[];
  template?: PrintTemplateConfig | null;
  options?: ProductLabelPrintOptions;
}) {
  const { title = "In tem sản phẩm", items, template, options } = params;
  const labelOptions = normalizeLabelOptions(options);
  const bodyHtml = renderProductLabelsHtml({
    items,
    template,
    options: labelOptions,
  });

  openPrintDocument({
    title,
    paperSize: "50mm",
    bodyHtml,
    labelGapMm: labelOptions.gapMm,
    labelScale: labelOptions.scale,
    customPageWidthMm: labelOptions.paperWidthMm,
    customPageHeightMm: labelOptions.paperHeightMm,
  });
}

export function renderOrderTemplateHtml(params: {
  order: any;
  template: PrintTemplateConfig;
}) {
  const { order, template } = params;
  const meta = parseStructuredNote(order?.note);

  const trackingCode = normalizeTrackingCode(order);
  const ghnSortCode = getGhnSortCode(order);
  const ghnSortCodeBlock = buildGhnSortCodeBlock(ghnSortCode, template.paperSize === "80mm");
  const ghnRequiredNoteLabel = getGhnRequiredNoteLabel(order);

  const codAmount = Number(order?.shipment?.codAmount || 0);
  const shippingFee = Number(
    order?.shipment?.shippingFee || order?.shippingFee || 0,
  );
  const finalAmount = Number(order?.finalAmount || 0);
  const subtotal = Number(order?.totalAmount || finalAmount);

  const amountDue =
    order?.paymentStatus === "PAID" || order?.paymentStatus === "REFUNDED"
      ? 0
      : order?.paymentStatus === "PENDING_COD" && codAmount > 0
        ? codAmount
        : finalAmount;

  const itemCount = Array.isArray(order?.items)
    ? order.items.reduce((sum: number, item: any) => sum + getItemQty(item), 0)
    : 0;

  const showOrderCode = templateFieldVisible(template, "showOrderCode");
  const showCreatedAt = templateFieldVisible(template, "showCreatedAt");
  const showCustomerName = templateFieldVisible(template, "showCustomerName");
  const showCustomerPhone = templateFieldVisible(template, "showCustomerPhone");
  const showShippingAddress = templateFieldVisible(
    template,
    "showShippingAddress",
  );
  const showItems = templateFieldVisible(template, "showItems");
  const showItemQty = templateFieldVisible(template, "showItemQty");
  const showFooter = templateFieldVisible(template, "showFooter");

  const itemsRows = showItems
    ? buildItemsRowsForPrint(order, template.templateType, showItemQty)
    : "";
  const shippingAddress = buildShippingAddress(order, meta.address || "");
  const noteValue = template.showNote ? buildCleanNote(order, meta) : "";

  const orderMetaCells = [
    showOrderCode
      ? `<div><b>Mã đơn:</b> ${escapeHtml(displayPrintOrderCode(order))}</div>`
      : "",
    showCreatedAt
      ? `<div style="text-align:right;"><b>Ngày tạo:</b> ${escapeHtml(order?.createdAt || "")}</div>`
      : "",
  ].filter(Boolean);

  const orderMetaBlock = orderMetaCells.length
    ? `<div style="display:grid;grid-template-columns:repeat(${orderMetaCells.length},1fr);gap:4px;align-items:start;margin-bottom:2px;font-size:8.8px;border-bottom:1px dashed #999;padding-bottom:2px;">${orderMetaCells.join("")}</div>`
    : "";

  const customerLines = [
    showCustomerName
      ? `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b>Người nhận:</b> ${escapeHtml(order?.shippingRecipientName || order?.customerName || "")}</div>`
      : "",
    showCustomerPhone
      ? `<div><b>SĐT:</b> ${escapeHtml(order?.shippingPhone || order?.customerPhone || "")}</div>`
      : "",
    showShippingAddress
      ? `<div style="height:22px;overflow:hidden;"><b>Đ/C:</b> ${escapeHtml(shippingAddress)}</div>`
      : "",
  ].filter(Boolean);

  const customerBlock = customerLines.length
    ? `<div style="font-size:9.5px;margin-bottom:2px;">${customerLines.join("")}</div>`
    : "";

  const itemsTopMm = ghnSortCodeBlock ? "40mm" : "33mm";

  const itemsBlock = showItems
    ? `<div style="position:absolute;left:2.5mm;right:2.5mm;top:${itemsTopMm};bottom:17mm;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:9.3px;line-height:1.05;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">Sản phẩm</th>
          ${showItemQty ? `<th style="text-align:center;width:17px;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">SL</th>` : ""}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
  </div>`
    : "";

  const longItemsBlock = showItems
    ? `<div style="font-size:12px; font-weight:700; margin-bottom:6px;">Nội dung hàng (${itemCount} sản phẩm)</div>
  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 0;">Tên sản phẩm</th>
        ${showItemQty ? `<th style="text-align:center; border-bottom:1px solid #ddd; padding:4px 0;">SL</th>` : ""}
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>`
    : "";

  const salesItemsBlock = showItems
    ? `<table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 0;">Sản phẩm</th>
        ${showItemQty ? `<th style="text-align:center; border-bottom:1px solid #ddd; padding:4px 0;">SL</th>` : ""}
        <th style="text-align:right; border-bottom:1px solid #ddd; padding:4px 0;">Đơn giá</th>
        <th style="text-align:right; border-bottom:1px solid #ddd; padding:4px 0;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>`
    : "";

  const footerBlock =
    showFooter && template.footerNote
      ? `<div style="margin-top:12px;text-align:center;font-size:11px;color:#444;">${escapeHtml(template.footerNote)}</div>`
      : "";

  const templateHasGhnSortToken = String(template.templateHtml || "").includes("{{ghnSortCodeBlock}}");

  const data: Record<string, string> = {
    title: escapeHtml(template.title),
    storeName: escapeHtml(
      order?.warehouseName || template.storeName || "THE 1970",
    ),
    storePhone: escapeHtml(order?.warehousePhone || template.storePhone || ""),
    storeAddress: escapeHtml(
      order?.warehouseAddress || template.storeAddress || "",
    ),
    footerNote: showFooter ? escapeHtml(template.footerNote || "") : "",

    orderCode: escapeHtml(displayPrintOrderCode(order)),
    createdAt: escapeHtml(order?.createdAt || ""),
    customerName: escapeHtml(
      order?.shippingRecipientName || order?.customerName || "",
    ),
    customerPhone: escapeHtml(
      order?.shippingPhone || order?.customerPhone || "",
    ),
    branchName: escapeHtml(order?.branchName || template.branchName || ""),

    shippingAddress: escapeHtml(shippingAddress),
    shippingMode: escapeHtml(meta.shippingMode || ""),
    shippingPartner: escapeHtml(
      order?.shipment?.carrier || meta.shippingPartner || "",
    ),
    note: escapeHtml(noteValue),
    ghnSortCode: escapeHtml(ghnSortCode),
    ghnSortCodeBlock,

    shippingFee: template.showShippingFee
      ? money(shippingFee)
      : money(shippingFee),
    codAmount: template.showCod ? money(codAmount) : money(codAmount),
    amountDue: money(amountDue),
    subtotal: money(subtotal),
    finalAmount: money(finalAmount),

    itemCount: String(itemCount),
    itemsRows,
    barcodeBlock: "",
    qrBlock: "",
    financialBlock:
      template.templateType === "shipping" && (template.showCod !== false || codAmount > 0 || amountDue > 0)
        ? `<div style="margin:2px 0 2px;">
              <table style="width:100%;border-collapse:collapse;text-align:center;">
                <tr>
                  <td style="border:1px solid #111;padding:2px 4px;">
                    <span style="font-size:9px;">THU HỘ (COD): </span>
                    <span style="font-size:13px;font-weight:900;">${money(codAmount || amountDue || 0)}</span>
                  </td>
                </tr>
              </table>
            </div>`
        : "",
    noteBlock:
      template.showNote && noteValue
        ? `<div style="border:1px dashed #999;padding:5px 6px;margin-bottom:8px;"><div style="font-weight:700;margin-bottom:2px;">Ghi chú</div><div>${escapeHtml(noteValue)}</div></div>`
        : "",
    orderMetaBlock,
    customerBlock,
    itemsBlock: template.paperSize === "80mm" ? itemsBlock : longItemsBlock,
    salesItemsBlock,
    footerBlock,
    ghnRequiredNote: escapeHtml(ghnRequiredNoteLabel),
    ghnRequiredNoteBlock: ghnRequiredNoteLabel
      ? `<div style="margin:1mm 0 1.4mm;text-align:center;font-size:8.5px;font-weight:900;letter-spacing:.2px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ghnRequiredNoteLabel)}</div>`
      : "",
  };

  if (template.templateType === "shipping" && template.paperSize === "80mm") {
    const codBlock = template.showCod && Number(codAmount || amountDue || 0) > 0
      ? `<div style="margin:1mm 0 1.2mm;"><table style="width:100%;border-collapse:collapse;text-align:center;"><tr><td style="border:1px solid #111;padding:1.4mm 2mm;"><span style="font-size:8.8px;">THU HỘ (COD): </span><span style="font-size:12.5px;font-weight:900;">${money(codAmount || amountDue || 0)}</span></td></tr></table></div>`
      : "";

    const requiredNoteBlock = ghnRequiredNoteLabel
      ? `<div style="margin:.8mm 0 1.2mm;text-align:center;font-size:8.2px;font-weight:900;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ghnRequiredNoteLabel)}</div>`
      : "";

    const barcodeBlock = trackingCode && template.showBarcode
      ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;"><img src="${barcodeUrl(trackingCode)}" style="width:36mm;height:12mm;object-fit:fill;display:block;margin:0 auto;" /><div style="margin-top:.2mm;font-size:6.8px;font-weight:800;line-height:1;white-space:nowrap;max-width:38mm;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(trackingCode)}</div></div>`
      : "";

    const qrBlock = trackingCode && template.showQr
      ? `<img src="${qrUrl(trackingCode)}" style="width:14mm;height:14mm;object-fit:contain;display:block;margin:0 auto;" />`
      : "";

    return `
<div style="width:80mm;height:80mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:9.4px;line-height:1.08;padding:2mm 2.5mm;border:1px solid #111;overflow:hidden;position:relative;">
  <div style="text-align:center;margin:0 0 1.4mm 0;">
    <div style="font-size:13.5px;font-weight:900;letter-spacing:.5px;line-height:1;">${data.storeName}</div>
    <div style="font-size:10.5px;font-weight:900;letter-spacing:.1px;margin-top:.5mm;">${data.title || "PHIẾU GIAO HÀNG"}</div>
  </div>

  ${orderMetaBlock}
  ${customerBlock}
  ${codBlock}
  ${ghnSortCodeBlock}
  ${requiredNoteBlock}

  ${showItems ? `<div style="position:absolute;left:2.5mm;right:2.5mm;top:${ghnSortCodeBlock || requiredNoteBlock ? "45mm" : codBlock ? "36mm" : "31mm"};bottom:18mm;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:9.1px;line-height:1.05;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #999;padding:1px 0;font-size:9.4px;">Sản phẩm</th>
          ${showItemQty ? `<th style="text-align:center;width:17px;border-bottom:1px solid #999;padding:1px 0;font-size:9.4px;">SL</th>` : ""}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>
  </div>` : ""}

  <div style="position:absolute;left:2.5mm;right:2.5mm;bottom:3mm;height:14mm;border-top:1px solid #111;padding-top:1mm;display:grid;grid-template-columns:1fr 16mm;gap:4mm;align-items:center;">
    <div style="text-align:center;">${barcodeBlock}</div>
    <div style="text-align:center;">${qrBlock}</div>
  </div>
</div>
    `.trim();
  }

  if (template.templateType === "sales") {
    if (
      template.templateHtml &&
      template.templateHtml.includes("{{itemsRows}}")
    ) {
      return replaceAllTokens(template.templateHtml, data);
    }
    return buildSalesTemplateHtml({ template, data });
  }

  if (
    template.templateHtml &&
    template.templateHtml.includes("{{itemsRows}}")
  ) {
    const templateHtmlForRender =
      template.templateType === "shipping" && !templateHasGhnSortToken && ghnSortCodeBlock
        ? String(template.templateHtml || "").replace(
            "{{financialBlock}}",
            "{{financialBlock}}\n{{ghnSortCodeBlock}}",
          )
        : template.templateHtml;

    let html = replaceAllTokens(templateHtmlForRender, {
      ...data,
      barcodeBlock:
        trackingCode && template.showBarcode
          ? `<img src="${barcodeUrl(trackingCode)}" style="width:30mm;height:12mm;object-fit:contain;display:block;margin:0 auto;" />`
          : "",
      qrBlock:
        trackingCode && template.showQr
          ? `<img src="${qrUrl(trackingCode)}" style="width:13mm;height:13mm;object-fit:contain;display:block;margin:0 auto;" />`
          : "",
    });

    if (template.templateType === "shipping" && ghnSortCodeBlock) {
      const nextItemsTop = template.showCod ? "43mm" : "40mm";
      html = html
        .replaceAll("top:33mm;bottom:17mm", `top:${nextItemsTop};bottom:17mm`)
        .replaceAll("top:33mm; bottom:17mm", `top:${nextItemsTop}; bottom:17mm`);
    }

    return html
      .replaceAll("NO-GHN-CODE", "")
      .replaceAll("Cảm ơn quý khách. Hẹn gặp lại!", "")
      .replaceAll("Cảm ơn quý khách", "")
      .replaceAll("Hẹn gặp lại!", "")
      .replaceAll('<div style="font-size:12px; margin-top:4px;"></div>', "");
  }

  return buildShippingTemplateHtml({
    template,
    data,
    trackingCode,
    noteValue,
    itemCount,
    ghnSortCode,
  });
}

export function renderTemplatePreviewHtml(template: PrintTemplateConfig) {
  const mockOrder = {
    orderCode: "DEMO-001",
    createdAt: "10:25:00 19/04/2026",
    customerName: "Nguyễn Văn A",
    shippingRecipientName: "Nguyễn Văn A",
    customerPhone: "0974000000",
    shippingPhone: "0974000000",
    shippingAddressLine1: "47 Sương Nguyệt Ánh",
    shippingWard: "Phường 9",
    shippingDistrict: "Thành phố Đà Lạt",
    shippingProvince: "Lâm Đồng",
    totalAmount: 520000,
    finalAmount: 550000,
    shippingFee: 30000,
    paymentStatus: "UNPAID",
    note: "Cách giao: partner | Đơn vị giao: ghn | Ghi chú giao hàng: Gọi trước khi giao",
    items: [
      {
        productName: "Sơ mi đen",
        sku: "SM-BLACK-M",
        color: "Black",
        size: "M",
        qty: 1,
        unitPrice: 520000,
        lineTotal: 520000,
      },
    ],
    shipment: {
      carrier: "ghn",
      trackingCode: "FJ0001",
      codAmount: 0,
      shippingFee: 30000,
      metadata: {
        sort_code: "HY-200-K-02-A3",
      },
    },
  };

  return renderOrderTemplateHtml({
    order: mockOrder,
    template,
  });
}

export function openPrintDocument(params: {
  title: string;
  paperSize: PrintPaperSize;
  bodyHtml: string;
  labelGapMm?: number;
  labelScale?: number;
  customPageWidthMm?: number;
  customPageHeightMm?: number;
}) {
  const {
    title,
    paperSize,
    bodyHtml,
    labelGapMm = 0.4,
    labelScale = 100,
    customPageWidthMm,
    customPageHeightMm,
  } = params;
  const win = window.open("", "_blank", "width=1100,height=900");
  if (!win) return;

  const pageSize =
    paperSize === "50mm"
      ? `${customPageWidthMm || 50}mm ${customPageHeightMm || 50}mm`
      : paperSize === "80mm"
        ? "80mm 80mm"
        : paperSize === "A5"
          ? "A5"
          : "A4";

  const pageWidth =
    paperSize === "50mm"
      ? `${customPageWidthMm || 50}mm`
      : paperSize === "80mm"
        ? "80mm"
        : paperSize === "A5"
          ? "148mm"
          : "190mm";

  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: ${paperSize === "50mm" || paperSize === "80mm" ? "0" : "4mm"};
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: Arial, sans-serif;
          }
          .print-page {
            width: ${pageWidth};
            min-height: ${paperSize === "50mm" ? `${customPageHeightMm || 50}mm` : paperSize === "80mm" ? "80mm" : "auto"};
            margin: ${paperSize === "50mm" ? `0 auto ${labelGapMm}mm auto` : paperSize === "80mm" ? "0 auto" : "0 auto 8mm auto"};
            page-break-after: always;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            overflow: hidden;
          }
          .print-page-inner {
            transform: scale(${Math.max(0.5, Math.min(1.5, Number(labelScale || 100) / 100))});
            transform-origin: top center;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <script>
        window.onload = function () {
  setTimeout(() => {
    window.print();
  }, 150);
};
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
