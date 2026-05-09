export type PrintTemplateType = "shipping" | "sales" | "transfer";
export type PrintPaperSize = "80mm" | "A4" | "A5";

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

  templateHtml: string;
};

// Đổi key lên v21 để xoá cache template cũ đang lưu trong localStorage.
// Nếu không đổi key, trình duyệt vẫn dùng HTML cũ nên sửa engine/config không ăn.
const STORAGE_KEY = "the1970.printTemplates.v22";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function getBranchOptions() {
  return [
    { id: "__default__", name: "DEFAULT" },
    { id: "b1", name: "Hoàn Kiếm" },
    { id: "b2", name: "Thái Hà" },
    { id: "b3", name: "Chùa Láng" },
    { id: "quoc-oai", name: "Quốc Oai" },
    { id: "qo-warehouse", name: "Kho QO" },
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
    b1: {
      storeName: "THE 1970 - Hoàn Kiếm",
      storeAddress: "",
      storePhone: "0975615475",
    },
    b2: {
      storeName: "THE 1970 - Thái Hà",
      storeAddress: "",
      storePhone: "0975615475",
    },
    b3: {
      storeName: "THE 1970 - Chùa Láng",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "quoc-oai": {
      storeName: "THE 1970 - Quốc Oai",
      storeAddress: "",
      storePhone: "0975615475",
    },
    "qo-warehouse": {
      storeName: "THE 1970 - Kho QO",
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
<div style="width:80mm;height:80mm;box-sizing:border-box;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:9.6px;line-height:1.08;padding:2.2mm 2.5mm;border:1px solid #111;overflow:hidden;position:relative;">
  <div style="text-align:center;margin:0 0 2px 0;">
    <div style="font-size:14px;font-weight:900;letter-spacing:.5px;line-height:1;">{{storeName}}</div>
    <div style="font-size:11px;font-weight:900;letter-spacing:.1px;margin-top:1px;">{{title}}</div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:start;margin-bottom:2px;font-size:8.8px;border-bottom:1px dashed #999;padding-bottom:2px;">
    <div><b>Mã đơn:</b> {{orderCode}}</div>
    <div style="text-align:right;"><b>Ngày tạo:</b> {{createdAt}}</div>
  </div>

  <div style="font-size:9.5px;margin-bottom:2px;">
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><b>Người nhận:</b> {{customerName}}</div>
    <div><b>SĐT:</b> {{customerPhone}}</div>
    <div style="height:22px;overflow:hidden;"><b>Đ/C:</b> {{shippingAddress}}</div>
  </div>

  {{financialBlock}}

  <div style="position:absolute;left:2.5mm;right:2.5mm;top:33mm;bottom:17mm;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:9.3px;line-height:1.05;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">Sản phẩm</th>
          <th style="text-align:center;width:17px;border-bottom:1px solid #999;padding:1px 0;font-size:9.6px;">SL</th>
        </tr>
      </thead>
      <tbody>{{itemsRows}}</tbody>
    </table>
  </div>

  <div style="position:absolute;left:2.5mm;right:2.5mm;bottom:5.5mm;height:11mm;border-top:1px solid #111;padding-top:2mm;display:grid;grid-template-columns:1fr 15mm;gap:5mm;align-items:center;">
    <div style="text-align:center;">{{barcodeBlock}}</div>
    <div style="text-align:center;">{{qrBlock}}</div>
  </div>

  <div style="position:absolute;left:2.5mm;right:2.5mm;bottom:1.7mm;text-align:center;font-size:8.3px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
    {{footerNote}}
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

function defaultTemplateHtml(
  type: PrintTemplateType,
  paperSize: PrintPaperSize
) {
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
      }
    );
  });

  return rows;
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

    return parsed;
  } catch {
    const defaults = buildDefaultPrintTemplates();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function savePrintTemplates(rows: PrintTemplateConfig[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
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
