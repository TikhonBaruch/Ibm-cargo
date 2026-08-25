import { productTitle, clarifySummary } from "./product-copy";
import { tariffHasCustoms } from "./tariffs";

export type PdfOrder = {
  id: string;
  title?: string;
  hs?: string;
  conf?: number;
  why?: string;
  risk?: string;
  route?: string;
  country?: string;
  city?: string;
  tariff?: string;
  broker?: string;
  duty?: string;
  vat?: string;
  fee?: string;
  sum?: string;
  price?: string;
  currency?: string;
  qty?: string;
  weightKg?: string;
  places?: string;
  incoterm?: string;
  docs?: { name: string }[];
  customsPaid?: boolean;
  desc?: string;
  lines?: { n: number; name: string; hs: string; conf?: number; qty?: string; price?: string; currency?: string }[];
};

const PAGE_W = 1191;
const PAGE_H = 1684;
const MARGIN = 64;

function dash(v: string | number | undefined) {
  if (v === undefined || v === null || v === "" || v === "—") return "—";
  return String(v);
}

function money(v?: string) {
  const s = dash(v);
  if (s === "—" || s === "тариф") return s;
  return s.includes("₽") ? s : `${s} ₽`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["—"];
}

function today() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function splitRoute(route?: string) {
  const parts = (route || "").split("→").map((s) => s.trim()).filter(Boolean);
  return { from: parts[0] || "", to: parts[1] || "" };
}

function enrichOrder(order: PdfOrder): PdfOrder {
  const { from, to } = splitRoute(order.route);
  const cityFromRoute = to && to !== "РФ" ? to : "";
  const country = order.country || from || "";
  const city = order.city || cityFromRoute || "";
  return {
    ...order,
    title: productTitle(order.title || order.desc || "Товар"),
    country: country || undefined,
    city: city || undefined,
    route: order.route || (country && city ? `${country} → ${city}` : country ? `${country} → РФ` : undefined),
  };
}

function brokerLine(order: PdfOrder) {
  const name = dash(order.broker);
  if (name !== "—") return name;
  if (order.tariff === "Под ключ") return "Будет назначен";
  return "Не входит в тариф";
}

function drawPages(order: PdfOrder) {
  const title = productTitle(order.title || order.desc || "Товар");
  const notes = clarifySummary(order.desc || "");
  const codeOnly = !tariffHasCustoms((order.tariff || "Код") as "Код" | "Таможня" | "Под ключ");
  const hasCalc = Boolean(order.duty && order.duty !== "—" && order.duty !== "тариф");
  const docs = (order.docs || []).map((d) => d.name).filter(Boolean);

  const pages: HTMLCanvasElement[] = [];
  let canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  let ctx = canvas.getContext("2d");
  if (!ctx) return pages;

  function newPage() {
    pages.push(canvas);
    canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    ctx = canvas.getContext("2d")!;
    paintBg();
    y = MARGIN;
  }

  function paintBg() {
    ctx!.fillStyle = "#f4f7fb";
    ctx!.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx!.fillStyle = "#1d4ed8";
    ctx!.fillRect(0, 0, PAGE_W, 112);
    ctx!.fillStyle = "#fff";
    ctx!.font = "700 22px Segoe UI, Arial, sans-serif";
    ctx!.fillText("LBM Брокер", MARGIN, 48);
    ctx!.font = "400 18px Segoe UI, Arial, sans-serif";
    ctx!.fillText(
      codeOnly ? "Справка по коду ТН ВЭД ЕАЭС" : "Расчёт кода ТН ВЭД ЕАЭС и таможенных платежей",
      MARGIN,
      82,
    );
    ctx!.fillStyle = "#64748b";
    ctx!.font = "400 16px Segoe UI, Arial, sans-serif";
    ctx!.fillText(`Сформировано ${today()}`, PAGE_W - MARGIN - 220, 82);
  }

  let y = 0;
  paintBg();
  y = 148;

  function need(h: number) {
    if (y + h > PAGE_H - 72) newPage();
  }

  function heading(text: string) {
    need(48);
    ctx!.fillStyle = "#0f172a";
    ctx!.font = "800 28px Segoe UI, Arial, sans-serif";
    ctx!.fillText(text, MARGIN, y + 28);
    y += 44;
  }

  function row(label: string, value: string) {
    const max = PAGE_W - MARGIN * 2 - 280;
    ctx!.font = "400 20px Segoe UI, Arial, sans-serif";
    const lines = wrap(ctx!, value || "—", max);
    need(28 * lines.length + 10);
    ctx!.fillStyle = "#64748b";
    ctx!.font = "400 18px Segoe UI, Arial, sans-serif";
    ctx!.fillText(label, MARGIN, y + 20);
    ctx!.fillStyle = "#0f172a";
    ctx!.font = "700 20px Segoe UI, Arial, sans-serif";
    lines.forEach((line, i) => {
      ctx!.fillText(line, MARGIN + 280, y + 20 + i * 26);
    });
    y += 28 * lines.length + 8;
  }

  function box(lines: string[], fill = "#fff") {
    const h = 24 * lines.length + 36;
    need(h + 8);
    ctx!.fillStyle = fill;
    roundRect(ctx!, MARGIN, y, PAGE_W - MARGIN * 2, h, 18);
    ctx!.fill();
    ctx!.fillStyle = "#0f172a";
    ctx!.font = "400 20px Segoe UI, Arial, sans-serif";
    lines.forEach((line, i) => ctx!.fillText(line, MARGIN + 24, y + 36 + i * 24));
    y += h + 16;
  }

  function drawPackTable(pack: NonNullable<PdfOrder["lines"]>) {
    const inner = PAGE_W - MARGIN * 2;
    const cols = [
      { title: "№", w: 52, align: "center" as const },
      { title: "Наименование", w: 0, align: "left" as const },
      { title: "Код ТН ВЭД", w: 210, align: "left" as const },
      { title: "Увер.", w: 86, align: "center" as const },
      { title: "Кол-во", w: 110, align: "right" as const },
      { title: "Цена", w: 150, align: "right" as const },
    ];
    cols[1].w = inner - cols.reduce((s, c) => s + c.w, 0);

    function colX(i: number) {
      let x = MARGIN;
      for (let k = 0; k < i; k += 1) x += cols[k].w;
      return x;
    }

    function cell(i: number, text: string, cy: number, bold = false, color = "#0f172a") {
      const col = cols[i];
      ctx!.fillStyle = color;
      ctx!.font = `${bold ? "700" : "400"} 16px Segoe UI, Arial, sans-serif`;
      const lines = wrap(ctx!, text || "—", col.w - 16);
      lines.forEach((line, n) => {
        const tw = ctx!.measureText(line).width;
        const x = col.align === "center"
          ? colX(i) + (col.w - tw) / 2
          : col.align === "right"
            ? colX(i) + col.w - 10 - tw
            : colX(i) + 10;
        ctx!.fillText(line, x, cy + n * 18);
      });
      return lines.length;
    }

    function header() {
      need(40);
      ctx!.fillStyle = "#1d4ed8";
      ctx!.fillRect(MARGIN, y, inner, 36);
      cols.forEach((col, i) => {
        ctx!.fillStyle = "#fff";
        ctx!.font = "700 14px Segoe UI, Arial, sans-serif";
        const tw = ctx!.measureText(col.title).width;
        const x = col.align === "center"
          ? colX(i) + (col.w - tw) / 2
          : col.align === "right"
            ? colX(i) + col.w - 10 - tw
            : colX(i) + 10;
        ctx!.fillText(col.title, x, y + 24);
      });
      y += 36;
    }

    header();
    pack.forEach((line, idx) => {
      ctx!.font = "400 16px Segoe UI, Arial, sans-serif";
      const nameLines = wrap(ctx!, line.name || "—", cols[1].w - 16);
      const h = Math.max(38, nameLines.length * 18 + 16);
      if (y + h > PAGE_H - 72) {
        newPage();
        header();
      }
      ctx!.fillStyle = idx % 2 ? "#f8fafc" : "#fff";
      ctx!.fillRect(MARGIN, y, inner, h);
      ctx!.strokeStyle = "#e2e8f0";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(MARGIN, y + h);
      ctx!.lineTo(MARGIN + inner, y + h);
      ctx!.stroke();
      const cy = y + 22;
      cell(0, String(line.n || idx + 1), cy, true, "#64748b");
      cell(1, line.name || "—", cy, true);
      cell(2, line.hs && line.hs !== "—" ? line.hs : "не готов", cy, true, line.hs && line.hs !== "—" ? "#1d4ed8" : "#94a3b8");
      cell(3, line.conf ? `${line.conf}%` : "—", cy, false, "#64748b");
      cell(4, line.qty ? `${line.qty} шт` : "—", cy);
      cell(5, line.price ? `${line.price} ${line.currency || ""}`.trim() : "—", cy);
      y += h;
    });
    y += 18;
  }

  heading(`Заявка #${order.id}`);
  row("Товар", title);
  if (notes) row("Уточнения", notes);
  if (codeOnly) {
    row("Страна происхождения", dash(order.country));
    row("Тариф услуги", dash(order.tariff));
  } else {
    row("Маршрут", dash(order.route) !== "—" ? dash(order.route) : `${dash(order.country)} → ${dash(order.city)}`);
    row("Происхождение", dash(order.country));
    row("Куда в РФ", dash(order.city));
    row("Условия поставки", dash(order.incoterm));
    row("Партия", [order.qty && `${order.qty} шт`, order.weightKg && `${order.weightKg} кг`, order.places && `${order.places} мест`].filter(Boolean).join(" · ") || "—");
    row("Стоимость по инвойсу", order.price ? `${order.price} ${order.currency || ""}`.trim() : "—");
    row("Тариф услуги", dash(order.tariff));
    row("Брокер", brokerLine(order));
  }

  heading("Код ТН ВЭД ЕАЭС");
  need(90);
  ctx!.fillStyle = "#1d4ed8";
  ctx!.font = "800 48px Segoe UI, Arial, sans-serif";
  ctx!.fillText(dash(order.hs), MARGIN, y + 48);
  y += 70;
  if (order.conf) row("Уверенность AI", `${order.conf}%`);
  if (order.why) {
    ctx!.font = "400 20px Segoe UI, Arial, sans-serif";
    const whyLines = wrap(ctx!, order.why, PAGE_W - MARGIN * 2);
    box(whyLines, "#e8eefc");
  }
  row("Риск", dash(order.risk));

  const pack = (order.lines || []).filter((l) => l.name);
  if (pack.length) {
    heading(`Позиции инвойса · ${pack.length}`);
    drawPackTable(pack);
  }

  heading("Таможенные платежи");
  if (codeOnly) {
    box(["В тариф «Код» таможенный расчёт не входит.", "Пошлина и НДС — в пакете «Таможня» или «Под ключ»."], "#fff7ed");
  } else if (hasCalc) {
    row("Пошлина", money(order.duty));
    row("НДС 20%", money(order.vat));
    row("Таможенный сбор", money(order.fee));
    row("К уплате на таможне", money(order.sum) === "—" ? dash(order.sum) : money(order.sum));
    row("Оплата на таможню", order.customsPaid ? "Оплачено" : "Не оплачено");
  } else {
    box(["В оплаченный тариф таможенный расчёт не входил.", "Пошлина и НДС появятся после доплаты пакета «Таможня»."], "#fff7ed");
  }

  heading("Документы");
  if (docs.length) box(docs.map((n, i) => `${i + 1}. ${n}`));
  else box(["Документы к заявке не приложены."], "#fff");

  need(80);
  ctx!.fillStyle = "#94a3b8";
  ctx!.font = "400 16px Segoe UI, Arial, sans-serif";
  const foot = wrap(
    ctx!,
    "Документ сформирован в кабинете LBM Брокер. Это расчёт для клиента, не таможенная декларация и не официальное заключение ФТС.",
    PAGE_W - MARGIN * 2,
  );
  foot.forEach((line, i) => ctx!.fillText(line, MARGIN, y + 20 + i * 20));

  pages.push(canvas);
  return pages;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function canvasJpeg(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
  const raw = dataUrl.split(",")[1] || "";
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function jpegPagesToPdf(images: { bytes: Uint8Array; w: number; h: number }[]) {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let pos = 0;
  const offsets = [0];

  function write(data: string | Uint8Array) {
    const u = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(u);
    pos += u.length;
  }

  function beginObj() {
    offsets.push(pos);
  }

  const n = images.length;
  const pageIds = images.map((_, i) => 3 + i * 3);
  const contentIds = images.map((_, i) => 4 + i * 3);
  const imageIds = images.map((_, i) => 5 + i * 3);

  write("%PDF-1.4\n");

  beginObj();
  write("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");

  beginObj();
  write(`2 0 obj << /Type /Pages /Count ${n} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >> endobj\n`);

  images.forEach((img, i) => {
    const pageId = pageIds[i];
    const contentId = contentIds[i];
    const imageId = imageIds[i];
    const draw = `q 595.28 0 0 841.89 0 0 cm /Im${i} Do Q\n`;

    beginObj();
    write(`${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${contentId} 0 R /Resources << /XObject << /Im${i} ${imageId} 0 R >> >> >> endobj\n`);

    beginObj();
    write(`${contentId} 0 obj << /Length ${draw.length} >> stream\n${draw}endstream endobj\n`);

    beginObj();
    write(`${imageId} 0 obj << /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >> stream\n`);
    write(img.bytes);
    write("\nendstream endobj\n");
  });

  const xrefPos = pos;
  write(`xref\n0 ${offsets.length}\n`);
  write("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i += 1) {
    write(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
  return new Blob([concat(chunks)], { type: "application/pdf" });
}

export function makeDemoPdfBlob(order: PdfOrder) {
  if (typeof document === "undefined") {
    throw new Error("PDF собирается в браузере");
  }
  const pages = drawPages(enrichOrder(order));
  if (!pages.length) {
    throw new Error("Не удалось нарисовать страницы PDF");
  }
  const images = pages.map((c) => ({ bytes: canvasJpeg(c), w: c.width, h: c.height })).filter((img) => img.bytes.length > 100);
  if (!images.length) {
    throw new Error("Не удалось закодировать страницы PDF");
  }
  const blob = jpegPagesToPdf(images);
  if (blob.size < 800) {
    throw new Error("PDF получился пустым");
  }
  return blob;
}

export function downloadDemoPdf(order: PdfOrder, onToast?: (msg: string) => void) {
  try {
    const blob = makeDemoPdfBlob(order);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lbm-${order.id}-tnved.pdf`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    onToast?.(`PDF #${order.id} скачан`);
  } catch {
    onToast?.("Не удалось собрать PDF — попробуйте ещё раз");
  }
}

export async function shareDemoPdf(order: PdfOrder, onToast?: (msg: string) => void) {
  let blob: Blob;
  try {
    blob = makeDemoPdfBlob(order);
  } catch {
    onToast?.("Не удалось собрать PDF — попробуйте ещё раз");
    return;
  }
  const file = new File([blob], `lbm-${order.id}-tnved.pdf`, { type: "application/pdf" });
  const shareUrl = `${window.location.origin}/client/orders/${order.id}`;
  const text = `Расчёт LBM Брокер #${order.id} · ТН ВЭД ${order.hs || "—"}`;

  try {
    const navAny = navigator as Navigator & {
      share?: (data: ShareData & { files?: File[] }) => Promise<void>;
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (typeof navAny.share === "function") {
      if (typeof navAny.canShare === "function" && !navAny.canShare({ files: [file] })) {
        throw new Error("cannot share files");
      }
      await navAny.share({ title: `Заявка #${order.id}`, text, url: shareUrl, files: [file] });
      onToast?.("PDF отправлен через «Поделиться»");
      return;
    }
  } catch {
    // fallback
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    onToast?.("Ссылка на заявку скопирована");
  } catch {
    onToast?.("Не удалось скопировать ссылку — попробуйте ещё раз");
  }
}
