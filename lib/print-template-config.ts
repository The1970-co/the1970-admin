export type PrintTemplateType = "shipping" | "sales" | "transfer" | "product_label";
export type PrintPaperSize = "50mm" | "80mm" | "A4" | "A5";

export type PrintTemplateConfig = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  templateType: PrintTemplateType;
  paperSize: PrintPaperSize;
  isDefault: boolean;

  title: string;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  footerNote: string;

  showBarcode: boolean;
  showQr: boolean;
  showCod: boolean;
  showShippingFee: boolean;
  showNote: boolean;
  showTotalQty?: boolean;

  showOrderCode?: boolean;
  showCreatedAt?: boolean;
  showCustomerName?: boolean;
  showCustomerPhone?: boolean;
  showShippingAddress?: boolean;
  showItems?: boolean;
  showItemQty?: boolean;
  showFooter?: boolean;

  templateHtml: string;
};

// Đổi key lên v21 để xoá cache template cũ đang lưu trong localStorage.
// Nếu không đổi key, trình duyệt vẫn dùng HTML cũ nên sửa engine/config không ăn.
const STORAGE_KEY = "the1970.printTemplates.v25";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function getBranchOptions() {
  return [
    { id: "__default__", name: "DEFAULT" },
    { id: "quoc-oai", name: "QUỐC OAI" },
    { id: "thai-ha", name: "THÁI HÀ" },
    { id: "chua-lang", name: "CHÙA LÁNG" },
    { id: "xa-dan", name: "XÃ ĐÀN" },
  ];
}

function getBranchContact(branchId: string, branchName: string) {
  const map: Record<
    string,
    {
      storeName: string;
      storeAddress: string;
      storePhone: string;
    }
  > = {
    "__default__": {
      storeName: "THE 1970",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "quoc-oai": {
      storeName: "THE 1970 - QUỐC OAI",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "thai-ha": {
      storeName: "THE 1970 - THÁI HÀ",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "chua-lang": {
      storeName: "THE 1970 - CHÙA LÁNG",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "xa-dan": {
      storeName: "THE 1970 - XÃ ĐÀN",
      storeAddress: "",
      storePhone: "0975615475",
    },
  };

  return (
    map[branchId] || {
      storeName: `THE 1970 - ${branchName}`,
      storeAddress: "",
      storePhone: "0975615475",
    }
  );
}

function defaultShipping80TemplateHtml() {
  return `
<div style="width:80mm;height:80mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:9.1px;line-height:1.04;padding:1.6mm 2.2mm;border:1px solid #111;overflow:hidden;position:relative;">
  <div style="text-align:center;margin:0 0 .8mm 0;">
    <div style="font-size:12.8px;font-weight:900;letter-spacing:.45px;line-height:1;">{{storeName}}</div>
    <div style="font-size:9.8px;font-weight:900;letter-spacing:.1px;margin-top:.25mm;">{{title}}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:start;margin-bottom:1px;font-size:8.2px;border-bottom:1px dashed #999;padding-bottom:1px;">
    <div><b>Mã đơn:</b> {{orderCode}}</div>
    <div style="text-align:right;"><b>Ngày tạo:</b> {{createdAt}}</div>
  </div>

  <div style="font-size:9px;margin-bottom:1px;line-height:1.05;">
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b>Người nhận:</b> {{customerName}}</div>
    <div><b>SĐT:</b> {{customerPhone}}</div>
    <div style="height:13px;overflow:hidden;"><b>Đ/C:</b> {{shippingAddress}}</div>
  </div>

  {{financialBlock}}
  {{shippingFeeBlock}}
  {{noteBlock}}

  <div style="position:absolute;left:2.2mm;right:2.2mm;top:29mm;bottom:15.5mm;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:9px;line-height:1.03;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">Sản phẩm</th>
          <th style="text-align:center;width:17px;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">SL</th>
        </tr>
      </thead>
      <tbody>{{itemsRows}}</tbody>
    </table>
  </div>

  <div style="position:absolute;left:2.2mm;right:2.2mm;bottom:2.2mm;height:12.5mm;border-top:1px solid #111;padding-top:.7mm;display:grid;grid-template-columns:1fr 14.5mm;gap:3.5mm;align-items:center;">
    <div style="text-align:center;">{{barcodeBlock}}</div>
    <div style="text-align:center;">{{qrBlock}}</div>
  </div>

</div>
`.trim();
}

function defaultShippingLongTemplateHtml() {
  return `
<div style="font-family: Arial, sans-serif; width: 100%; color:#111; box-sizing:border-box;">
  <div style="text-align:center; font-weight:700; font-size:16px; margin-bottom:2px;">
    {{storeName}}
  </div>

  <div style="text-align:center; font-weight:700; font-size:17px; margin-bottom:6px;">
    {{title}}
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; line-height:1.55;">
    <tr>
      <td style="padding:2px 0;"><b>Mã đơn:</b> {{orderCode}}</td>
      <td style="padding:2px 0; text-align:right;"><b>Ngày tạo:</b> {{createdAt}}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:2px 0;"><b>Người nhận:</b> {{customerName}}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:2px 0;"><b>SĐT:</b> {{customerPhone}}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding:2px 0;"><b>Đ/C:</b> {{shippingAddress}}</td>
    </tr>
    {{financialBlock}}
    {{shippingFeeBlock}}
    {{noteBlock}}
  </table>

  <div style="border-top:1px solid #111; margin:10px 0 8px;"></div>

  <div style="font-size:12px; font-weight:700; margin-bottom:6px;">
    Nội dung hàng ({{itemCount}} sản phẩm)
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 0;">Tên sản phẩm</th>
        <th style="text-align:center; border-bottom:1px solid #ddd; padding:4px 0;">SL</th>
      </tr>
    </thead>
    <tbody>
      {{itemsRows}}
    </tbody>
  </table>
  {{totalQtyBlock}}

  <div style="margin-top:14px; text-align:center;">
    {{barcodeBlock}}
  </div>

  <div style="margin-top:10px; text-align:center;">
    {{qrBlock}}
  </div>

  <div style="margin-top:12px; text-align:center; font-size:11px; color:#444;">
    {{footerNote}}
  </div>
</div>
`.trim();
}


function defaultProductLabel50TemplateHtml() {
  return `
<div style="width:50mm;height:50mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#111;font-family:Arial,sans-serif;border:1px solid #777;border-radius:1.4mm;overflow:hidden;position:relative;padding:1.2mm;">
  <div style="display:grid;grid-template-columns:1fr 5mm 1fr;align-items:center;font-size:5px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;height:4.6mm;border-bottom:1px solid #999;">
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">THE 1970.VN®</div>
    <div style="text-align:center;font-size:10px;line-height:1;">♻</div>
    <div style="text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">MADE IN VIETNAM</div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;top:6mm;height:17mm;text-align:center;border-left:1px solid #999;border-right:1px solid #999;">
    <div style="font-size:8px;font-weight:900;line-height:1.1;height:4.2mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 .8mm;">
      {{productName}}
    </div>
    <div style="height:9mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">
      {{barcodeBlock}}
    </div>
    <div style="font-size:10px;font-weight:900;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      {{sku}}
    </div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;top:23mm;height:17.2mm;border:1px solid #999;display:grid;grid-template-columns:10mm 1fr 17mm;grid-template-rows:8.6mm 8.6mm;">
    <div style="border-right:1px solid #999;border-bottom:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">CỠ</div>
    <div style="border-right:1px solid #999;border-bottom:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;">{{size}}</div>
    <div style="grid-row:1 / span 2;grid-column:3;border-left:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5mm;overflow:hidden;">
      {{qrBlock}}
      <div style="font-size:6px;font-weight:900;line-height:1;white-space:nowrap;max-width:15mm;overflow:hidden;text-overflow:ellipsis;">{{sku}}</div>
    </div>
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">MÀU</div>
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 .8mm;">{{color}}</div>
  </div>

  <div style="position:absolute;left:1.2mm;right:1.2mm;bottom:1.2mm;height:8.6mm;border:1px solid #999;display:grid;grid-template-columns:10mm 1fr;">
    <div style="border-right:1px solid #999;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">GIÁ</div>
    <div style="display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;letter-spacing:.2px;white-space:nowrap;overflow:hidden;">
      {{price}}
    </div>
  </div>
</div>
`.trim();
}

function defaultTemplateHtml(
  type: PrintTemplateType,
  paperSize: PrintPaperSize
) {
  if (type === "product_label") {
    return defaultProductLabel50TemplateHtml();
  }
  if (type === "shipping") {
    return paperSize === "80mm"
      ? defaultShipping80TemplateHtml()
      : defaultShippingLongTemplateHtml();
  }

  if (type === "sales") {
    return `
<div style="font-family: Arial, sans-serif; width: 100%; color:#111;">
  <div style="text-align:center; font-weight:700; font-size:18px;">{{storeName}}</div>
  <div style="text-align:center; font-size:12px; line-height:1.4; margin-top:4px;">
    {{storePhone}}<br/>
    {{storeAddress}}
  </div>

  <div style="margin:10px 0; border-top:1px solid #111;"></div>

  <div style="text-align:center; font-weight:700; font-size:15px; margin-bottom:8px;">
    {{title}}
  </div>

  <div style="font-size:12px; line-height:1.6;">
    <div><b>Mã đơn:</b> {{orderCode}}</div>
    <div><b>Ngày tạo:</b> {{createdAt}}</div>
    <div><b>Khách:</b> {{customerName}}</div>
    <div><b>SĐT:</b> {{customerPhone}}</div>
  </div>

  <div style="margin:10px 0; border-top:1px dashed #999;"></div>

  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 0;">Sản phẩm</th>
        <th style="text-align:center; border-bottom:1px solid #ddd; padding:4px 0;">SL</th>
        <th style="text-align:right; border-bottom:1px solid #ddd; padding:4px 0;">Đơn giá</th>
        <th style="text-align:right; border-bottom:1px solid #ddd; padding:4px 0;">Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      {{itemsRows}}
    </tbody>
  </table>
  {{totalQtyBlock}}

  <div style="margin-top:10px; font-size:12px; line-height:1.7;">
    <div style="display:flex; justify-content:space-between;">
      <span>Tạm tính</span>
      <b>{{subtotal}}</b>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <span>Phí ship</span>
      <b>{{shippingFee}}</b>
    </div>
    <div style="display:flex; justify-content:space-between;">
      <span>Khách còn phải trả</span>
      <b>{{amountDue}}</b>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:14px; margin-top:4px;">
      <span><b>Tổng tiền</b></span>
      <b>{{finalAmount}}</b>
    </div>
  </div>

  <div style="margin-top:12px; text-align:center; font-size:11px; color:#444;">
    {{footerNote}}
  </div>
</div>
    `.trim();
  }

  return `
<div style="font-family: Arial, sans-serif; width: 100%; color:#111;">
  <div style="text-align:center; font-weight:700; font-size:18px;">{{storeName}}</div>
  <div style="text-align:center; font-size:12px; line-height:1.4; margin-top:4px;">
    {{storePhone}}<br/>
    {{storeAddress}}
  </div>

  <div style="margin:10px 0; border-top:1px solid #111;"></div>

  <div style="text-align:center; font-weight:700; font-size:15px; margin-bottom:8px;">
    {{title}}
  </div>

  <div style="font-size:12px; line-height:1.6;">
    <div><b>Mã phiếu:</b> {{orderCode}}</div>
    <div><b>Ngày tạo:</b> {{createdAt}}</div>
    <div><b>Chi nhánh:</b> {{branchName}}</div>
    <div><b>Ghi chú:</b> {{note}}</div>
  </div>

  <div style="margin:10px 0; border-top:1px dashed #999;"></div>

  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 0;">Sản phẩm</th>
        <th style="text-align:center; border-bottom:1px solid #ddd; padding:4px 0;">SL</th>
      </tr>
    </thead>
    <tbody>
      {{itemsRows}}
    </tbody>
  </table>

  <div style="margin-top:12px; text-align:center; font-size:11px; color:#444;">
    {{footerNote}}
  </div>
</div>
  `.trim();
}


function normalizeBranchName(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAllowedPrintBranch(input: {
  branchId?: string | null;
  branchName?: string | null;
}) {
  const rawId = String(input.branchId || "").trim();
  const rawName = String(input.branchName || "").trim();
  const text = normalizeBranchName(`${rawId} ${rawName}`);

  if (!rawId || rawId === "__default__" || text.includes("default")) {
    return { id: "__default__", name: "DEFAULT" };
  }

  if (
    text.includes("hoan kiem") ||
    text.includes("xa dan") ||
    text === "xd" ||
    text.includes(" x d")
  ) {
    return { id: "xa-dan", name: "XÃ ĐÀN" };
  }

  if (text.includes("thai ha") || text === "th" || text.includes(" t h")) {
    return { id: "thai-ha", name: "THÁI HÀ" };
  }

  if (text.includes("chua lang") || text === "cl" || text.includes(" c l")) {
    return { id: "chua-lang", name: "CHÙA LÁNG" };
  }

  if (
    text.includes("quoc oai") ||
    text.includes("kho qo") ||
    text.includes("qo warehouse") ||
    text === "qo" ||
    text.includes(" q o")
  ) {
    return { id: "quoc-oai", name: "QUỐC OAI" };
  }

  return { id: "quoc-oai", name: "QUỐC OAI" };
}

function normalizePrintTemplateBranch(template: PrintTemplateConfig) {
  const branch = resolveAllowedPrintBranch({
    branchId: template.branchId,
    branchName: template.branchName,
  });
  const contact = getBranchContact(branch.id, branch.name);

  const oldBranchName = String(template.branchName || "").trim();
  const oldName = String(template.name || "").trim();
  const suffix = oldName.includes(" - ")
    ? oldName.split(" - ").slice(1).join(" - ")
    : oldName || template.title || "Mẫu in";

  const shouldRenameName =
    !oldName ||
    Boolean(oldBranchName && oldName.startsWith(`${oldBranchName} - `)) ||
    /^(Hoàn Kiếm|Kho QO|Quốc Oai|Thái Hà|Chùa Láng|Xã Đàn|DEFAULT)\s+-\s+/i.test(oldName);

  return {
    ...template,
    branchId: branch.id,
    branchName: branch.name,
    name: shouldRenameName ? `${branch.name} - ${suffix}` : oldName,
    storeName:
      !template.storeName ||
      /Hoàn Kiếm|Kho QO|Quốc Oai|Thái Hà|Chùa Láng|Xã Đàn/i.test(template.storeName)
        ? contact.storeName
        : template.storeName,
    storeAddress: template.storeAddress ?? contact.storeAddress,
    storePhone: template.storePhone || contact.storePhone,
    showTotalQty:
      typeof (template as any).showTotalQty === "boolean"
        ? (template as any).showTotalQty
        : template.templateType !== "product_label",
  };
}

function ensurePosPrintTemplates(rows: PrintTemplateConfig[]) {
  const next = [...rows];

  getBranchOptions().forEach((branch) => {
    const exists = next.some(
      (template) =>
        template.branchId === branch.id &&
        template.templateType === "sales" &&
        template.paperSize === "80mm" &&
        normalizeBranchName(template.name).includes("pos"),
    );

    if (exists) return;

    const contact = getBranchContact(branch.id, branch.name);
    next.push({
      id: uid(),
      name: `${branch.name} - Phiếu bán hàng POS 80mm`,
      branchId: branch.id,
      branchName: branch.name,
      templateType: "sales",
      paperSize: "80mm",
      isDefault: false,
      title: "PHIẾU BÁN HÀNG POS",
      templateHtml: defaultTemplateHtml("sales", "80mm"),
      storeName: contact.storeName,
      storeAddress: contact.storeAddress,
      storePhone: contact.storePhone,
      footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
      showBarcode: true,
      showQr: true,
      showCod: true,
      showShippingFee: true,
      showNote: true,
    });
  });

  return next;
}

function migratePrintTemplates(rows: PrintTemplateConfig[]) {
  return ensurePosPrintTemplates(rows.map(normalizePrintTemplateBranch));
}

export function buildDefaultPrintTemplates(): PrintTemplateConfig[] {
  const branches = getBranchOptions();
  const rows: PrintTemplateConfig[] = [];

  branches.forEach((branch) => {
    const contact = getBranchContact(branch.id, branch.name);

    const common = {
      storeName: contact.storeName,
      storeAddress: contact.storeAddress,
      storePhone: contact.storePhone,
      footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
      showBarcode: true,
      showQr: true,
      showCod: false,
      showShippingFee: false,
      showNote: false,
      showTotalQty: true,
    };

    rows.push(
      {
        id: uid(),
        name: `${branch.name} - Phiếu giao hàng 80mm`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "shipping",
        paperSize: "80mm",
        isDefault: true,
        title: "PHIẾU GIAO HÀNG",
        templateHtml: defaultTemplateHtml("shipping", "80mm"),
        ...common,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu giao hàng A4`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "shipping",
        paperSize: "A4",
        isDefault: true,
        title: "PHIẾU GIAO HÀNG",
        templateHtml: defaultTemplateHtml("shipping", "A4"),
        ...common,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu giao hàng A5`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "shipping",
        paperSize: "A5",
        isDefault: true,
        title: "PHIẾU GIAO HÀNG",
        templateHtml: defaultTemplateHtml("shipping", "A5"),
        ...common,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu bán hàng 80mm`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "sales",
        paperSize: "80mm",
        isDefault: true,
        title: "PHIẾU BÁN HÀNG",
        templateHtml: defaultTemplateHtml("sales", "80mm"),
        storeName: contact.storeName,
        storeAddress: contact.storeAddress,
        storePhone: contact.storePhone,
        footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
        showBarcode: true,
        showQr: true,
        showCod: true,
        showShippingFee: true,
        showNote: true,
        showTotalQty: true,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu nhập/chuyển kho 80mm`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "transfer",
        paperSize: "80mm",
        isDefault: true,
        title: "PHIẾU CHUYỂN / NHẬP KHO",
        templateHtml: defaultTemplateHtml("transfer", "80mm"),
        storeName: contact.storeName,
        storeAddress: contact.storeAddress,
        storePhone: contact.storePhone,
        footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
        showBarcode: true,
        showQr: true,
        showCod: true,
        showShippingFee: true,
        showNote: true,
        showTotalQty: true,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu nhập/chuyển kho A4`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "transfer",
        paperSize: "A4",
        isDefault: true,
        title: "PHIẾU CHUYỂN / NHẬP KHO",
        templateHtml: defaultTemplateHtml("transfer", "A4"),
        storeName: contact.storeName,
        storeAddress: contact.storeAddress,
        storePhone: contact.storePhone,
        footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
        showBarcode: true,
        showQr: true,
        showCod: true,
        showShippingFee: true,
        showNote: true,
        showTotalQty: true,
      },
      {
        id: uid(),
        name: `${branch.name} - Phiếu nhập/chuyển kho A5`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "transfer",
        paperSize: "A5",
        isDefault: true,
        title: "PHIẾU CHUYỂN / NHẬP KHO",
        templateHtml: defaultTemplateHtml("transfer", "A5"),
        storeName: contact.storeName,
        storeAddress: contact.storeAddress,
        storePhone: contact.storePhone,
        footerNote: "Cảm ơn quý khách. Hẹn gặp lại!",
        showBarcode: true,
        showQr: true,
        showCod: true,
        showShippingFee: true,
        showNote: true,
        showTotalQty: true,
      },
      {
        id: uid(),
        name: `${branch.name} - Tem sản phẩm 50x50`,
        branchId: branch.id,
        branchName: branch.name,
        templateType: "product_label",
        paperSize: "50mm",
        isDefault: true,
        title: "TEM SẢN PHẨM",
        templateHtml: defaultTemplateHtml("product_label", "50mm"),
        storeName: "THE 1970.VN",
        storeAddress: "",
        storePhone: "",
        footerNote: "",
        showBarcode: true,
        showQr: true,
        showCod: false,
        showShippingFee: false,
        showNote: false,
        showTotalQty: false,
      }
    );
  });

  return ensurePosPrintTemplates(rows);
}

export function loadPrintTemplates(): PrintTemplateConfig[] {
  if (typeof window === "undefined") return buildDefaultPrintTemplates();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = buildDefaultPrintTemplates();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }

    const parsed = JSON.parse(raw) as PrintTemplateConfig[];
    if (!Array.isArray(parsed) || !parsed.length) {
      const defaults = buildDefaultPrintTemplates();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }

    const migrated = migratePrintTemplates(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    const defaults = buildDefaultPrintTemplates();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function savePrintTemplates(rows: PrintTemplateConfig[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migratePrintTemplates(rows)));
}

export function findPrintTemplate(params: {
  templates: PrintTemplateConfig[];
  branchId?: string | null;
  templateType: PrintTemplateType;
  paperSize: PrintPaperSize;
}) {
  const { templates, branchId, templateType, paperSize } = params;
  const safeBranchId = branchId || "__default__";

  const exactDefault = templates.find(
    (t) =>
      t.branchId === safeBranchId &&
      t.templateType === templateType &&
      t.paperSize === paperSize &&
      t.isDefault
  );
  if (exactDefault) return exactDefault;

  const exact = templates.find(
    (t) =>
      t.branchId === safeBranchId &&
      t.templateType === templateType &&
      t.paperSize === paperSize
  );
  if (exact) return exact;

  const fallbackDefault = templates.find(
    (t) =>
      t.branchId === "__default__" &&
      t.templateType === templateType &&
      t.paperSize === paperSize &&
      t.isDefault
  );
  if (fallbackDefault) return fallbackDefault;

  return (
    templates.find(
      (t) => t.templateType === templateType && t.paperSize === paperSize
    ) || null
  );
}
