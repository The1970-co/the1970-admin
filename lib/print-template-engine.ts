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
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
    data || "EMPTY"
  )}&code=Code128&dpi=96`;
}

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
    data || "EMPTY"
  )}`;
}

function replaceAllTokens(template: string, data: Record<string, string>) {
  let html = template;
  Object.entries(data).forEach(([key, value]) => {
    html = html.replaceAll(`{{${key}}}`, value);
  });
  return html;
}

function buildItemsRows(order: any, type: string) {
  const items = Array.isArray(order?.items) ? order.items : [];

  if (type === "sales") {
    return items
      .map(
        (item: any) => `
<tr>
  <td style="padding:4px 0; border-bottom:1px dashed #ddd;">
    ${escapeHtml(item.productName || "SP")}
    <div style="font-size:11px; color:#666;">
      ${escapeHtml(item.sku || "")}
      ${item.color ? ` · ${escapeHtml(item.color)}` : ""}
      ${item.size ? ` / ${escapeHtml(item.size)}` : ""}
    </div>
  </td>
  <td style="padding:4px 0; text-align:center; border-bottom:1px dashed #ddd;">${item.qty || 0}</td>
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(Number(item.unitPrice || 0))}</td>
  <td style="padding:4px 0; text-align:right; border-bottom:1px dashed #ddd;">${money(Number(item.lineTotal || 0))}</td>
</tr>
        `.trim()
      )
      .join("");
  }

  return items
    .map(
      (item: any) => `
<tr>
  <td style="padding:4px 0; border-bottom:1px dashed #ddd;">
    ${escapeHtml(item.productName || "SP")}
    <div style="font-size:11px; color:#666;">
      ${escapeHtml(item.sku || "")}
      ${item.color ? ` · ${escapeHtml(item.color)}` : ""}
      ${item.size ? ` / ${escapeHtml(item.size)}` : ""}
    </div>
  </td>
  <td style="padding:4px 0; text-align:center; border-bottom:1px dashed #ddd;">${item.qty || 0}</td>
</tr>
      `.trim()
    )
    .join("");
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

function shortenNote(value?: string, max = 140) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildCleanNote(order: any, meta: ReturnType<typeof parseStructuredNote>) {
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
}) {
  const { template, data, trackingCode, noteValue, itemCount } = params;

  const hasTracking = Boolean(trackingCode);

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

  <div style="text-align:center;font-size:20px;font-weight:700;margin-bottom:8px;">
    PHIẾU GIAO HÀNG
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="vertical-align:top;font-size:11px;">
        <div><strong>Mã đơn:</strong> ${data.orderCode}</div>
      </td>
      <td style="vertical-align:top;text-align:right;font-size:11px;">
        <div><strong>Ngày tạo:</strong> ${data.createdAt}</div>
      </td>
    </tr>
  </table>

  <div style="margin-bottom:8px;">
    <div><strong>Người nhận:</strong> ${data.customerName}</div>
    <div style="margin-top:2px;"><strong>SĐT:</strong> ${data.customerPhone}</div>
    <div style="margin-top:2px;"><strong>Đ/C:</strong> ${data.shippingAddress}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="width:50%;vertical-align:top;">
        <div><strong>Cách giao:</strong> ${data.shippingMode || "—"}</div>
        <div style="margin-top:2px;"><strong>Thu hộ:</strong> ${data.codAmount || "0đ"}</div>
      </td>
      <td style="width:50%;vertical-align:top;text-align:right;">
        <div><strong>Đơn vị VC:</strong> ${data.shippingPartner || "—"}</div>
        <div style="margin-top:2px;"><strong>Phí ship:</strong> ${data.shippingFee || "0đ"}</div>
      </td>
    </tr>
  </table>

  ${
    noteValue
      ? `
    <div style="border:1px dashed #999;padding:5px 6px;margin-bottom:8px;">
      <div style="font-weight:700;margin-bottom:2px;">Ghi chú</div>
      <div>${escapeHtml(noteValue)}</div>
    </div>
  `
      : ""
  }

  <div style="border-top:1px dashed #999;border-bottom:1px dashed #999;padding:6px 0;margin-bottom:8px;">
    <div style="font-weight:700;margin-bottom:4px;">Nội dung hàng (${itemCount} sản phẩm)</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;padding-bottom:4px;">Sản phẩm</th>
          <th style="text-align:right;font-size:11px;padding-bottom:4px;">SL</th>
        </tr>
      </thead>
      <tbody>
        ${data.itemsRows}
      </tbody>
    </table>
  </div>

  ${
    hasTracking && template.showBarcode
      ? `
    <div style="text-align:center;margin:10px 0 6px;">
      <img
        src="${barcodeUrl(trackingCode)}"
        style="max-width:100%;height:72px;object-fit:contain;"
      />
      <div style="margin-top:4px;font-size:12px;font-weight:700;letter-spacing:.3px;">
        ${escapeHtml(trackingCode)}
      </div>
    </div>
  `
      : ""
  }

  ${
    hasTracking && template.showQr
      ? `
    <div style="text-align:center;margin-top:6px;">
      <img
        src="${qrUrl(trackingCode)}"
        style="width:96px;height:96px;object-fit:contain;"
      />
    </div>
  `
      : ""
  }

  <div style="text-align:center;font-size:10px;color:#555;margin-top:10px;">
    ${data.footerNote || "Cảm ơn quý khách. Hẹn gặp lại!"}
  </div>
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

  <div style="text-align:center;font-size:10px;color:#555;margin-top:10px;">
    ${data.footerNote || "Cảm ơn quý khách. Hẹn gặp lại!"}
  </div>
</div>
  `.trim();
}

export function renderOrderTemplateHtml(params: {
  order: any;
  template: PrintTemplateConfig;
}) {
  const { order, template } = params;
  const meta = parseStructuredNote(order?.note);

  const trackingCode = normalizeTrackingCode(order);

  const codAmount = Number(order?.shipment?.codAmount || 0);
  const shippingFee = Number(
    order?.shipment?.shippingFee || order?.shippingFee || 0
  );
  const finalAmount = Number(order?.finalAmount || 0);
  const subtotal = Number(order?.totalAmount || finalAmount);

  const amountDue =
    order?.paymentStatus === "PAID" || order?.paymentStatus === "REFUNDED"
      ? 0
      : order?.paymentStatus === "PENDING_COD" && codAmount > 0
        ? codAmount
        : finalAmount;

  const itemCount = Array.isArray(order?.items) ? order.items.length : 0;
  const itemsRows = buildItemsRows(order, template.templateType);
  const shippingAddress = buildShippingAddress(order, meta.address || "");
  const noteValue = template.showNote ? buildCleanNote(order, meta) : "";

  const data: Record<string, string> = {
    title: escapeHtml(template.title),
    storeName: escapeHtml(order?.warehouseName || template.storeName || "THE 1970"),
    storePhone: escapeHtml(order?.warehousePhone || template.storePhone || ""),
    storeAddress: escapeHtml(order?.warehouseAddress || template.storeAddress || ""),
    footerNote: escapeHtml(template.footerNote || "Cảm ơn quý khách. Hẹn gặp lại!"),

    orderCode: escapeHtml(order?.orderCode || ""),
    createdAt: escapeHtml(order?.createdAt || ""),
    customerName: escapeHtml(
      order?.shippingRecipientName || order?.customerName || ""
    ),
    customerPhone: escapeHtml(order?.shippingPhone || order?.customerPhone || ""),
    branchName: escapeHtml(order?.branchName || template.branchName || ""),

    shippingAddress: escapeHtml(shippingAddress),
    shippingMode: escapeHtml(meta.shippingMode || ""),
    shippingPartner: escapeHtml(
      order?.shipment?.carrier || meta.shippingPartner || ""
    ),
    note: escapeHtml(noteValue),

    shippingFee: template.showShippingFee ? money(shippingFee) : money(shippingFee),
    codAmount: template.showCod ? money(codAmount) : money(codAmount),
    amountDue: money(amountDue),
    subtotal: money(subtotal),
    finalAmount: money(finalAmount),

    itemCount: String(itemCount),
    itemsRows,
    barcodeBlock: "",
    qrBlock: "",
    financialBlock: "",
    noteBlock: "",
  };

  if (template.templateType === "sales") {
    if (template.templateHtml && template.templateHtml.includes("{{itemsRows}}")) {
      return replaceAllTokens(template.templateHtml, data);
    }
    return buildSalesTemplateHtml({ template, data });
  }

  if (template.templateHtml && template.templateHtml.includes("{{itemsRows}}")) {
    const html = replaceAllTokens(template.templateHtml, {
      ...data,
      barcodeBlock:
        trackingCode && template.showBarcode
          ? `<img src="${barcodeUrl(
              trackingCode
            )}" style="max-width:100%; height:72px; object-fit:contain;" /><div style="font-size:12px; margin-top:4px;">${escapeHtml(
              trackingCode
            )}</div>`
          : "",
      qrBlock:
        trackingCode && template.showQr
          ? `<img src="${qrUrl(
              trackingCode
            )}" style="width:96px; height:96px; object-fit:contain;" />`
          : "",
    });

    return html
      .replaceAll("NO-GHN-CODE", "")
      .replaceAll("<div style=\"font-size:12px; margin-top:4px;\"></div>", "");
  }

  return buildShippingTemplateHtml({
    template,
    data,
    trackingCode,
    noteValue,
    itemCount,
  });
}

export function renderTemplatePreviewHtml(template: PrintTemplateConfig) {
  const mockOrder = {
    orderCode: "ORD-DEMO-001",
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
}) {
  const { title, paperSize, bodyHtml } = params;
  const win = window.open("", "_blank", "width=1100,height=900");
  if (!win) return;

  const pageSize =
    paperSize === "80mm" ? "80mm auto" : paperSize === "A5" ? "A5" : "A4";

  const pageWidth =
    paperSize === "80mm" ? "76mm" : paperSize === "A5" ? "148mm" : "190mm";

  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: 4mm;
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
            margin: 0 auto 8mm auto;
            page-break-after: always;
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