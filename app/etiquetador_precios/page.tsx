// app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Settings,
  Printer,
  Plus,
  Trash2,
  Minus,
  Loader2,
  AlertCircle,
  Upload,
  Download,
  LayoutTemplate,
  RotateCcw,
  Search,
  Camera,
  Keyboard,
} from "lucide-react";
import * as XLSX from "xlsx";
import Noty from "noty";
import "noty/lib/noty.css";
import "noty/lib/themes/mint.css";

// ====== NUEVO: importar tipos, utils y templates del registry ======
import type { ArticleItem, LabelTemplate } from "@/lib/labels/types";
import { mmToPx, money } from "@/lib/labels/utils";
import { LABEL_TEMPLATES, getTemplate } from "@/components/labels/templates";
export type TemplateId = (typeof LABEL_TEMPLATES)[number]["id"];

// ============= Utils locales =============
const SCS = [
  { id: "19", nombre: "TOTOLCINGO" },
  { id: "9603355", nombre: "VIA MORELOS" },
  { id: "7506737", nombre: "TEPEXPAN" },
  { id: "9604500", nombre: "VALLEJO" },
  { id: "94274615", nombre: "TEXCOCO" },
  { id: "188104", nombre: "CEDIS" },
];

const todayMX = () =>
  new Date().toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

declare global {
  interface Window {
    JsBarcode?: any;
  }
}

async function ensureJsBarcodeLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.JsBarcode) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      "jsbarcode-cdn"
    ) as HTMLScriptElement | null;
    if (existing && window.JsBarcode) return resolve();
    const s = document.createElement("script");
    s.id = "jsbarcode-cdn";
    s.src =
      "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar JsBarcode"));
    document.head.appendChild(s);
  });
}

function renderAllBarcodes(root: HTMLElement | Document = document) {
  const els = Array.from(root.querySelectorAll<SVGSVGElement>(".jsb"));
  if (!els.length || !window.JsBarcode) return;
  for (const el of els) {
    const code = el.getAttribute("data-code") || "";
    try {
      window.JsBarcode(el, code, {
        format: "CODE128",
        displayValue: false,
        height: 50,
        margin: 0,
      });
    } catch {
      /* noop */
    }
  }
}

// ========= Normalización/validación de ubicaciones =========
const UBIC_REGEX = /^[A-Z0-9]{1,4}-(?:[A-Z0-9]{1,4}-){0,3}[A-Z0-9]{1,4}$/;

function normalizeCandidate(raw: string) {
  let s = (raw || "").trim().toUpperCase();
  s = s.replace(/[–—_＋+]/g, "-"); // normaliza guiones visualmente parecidos
  const map: Record<string, string> = {
    O: "0",
    I: "1",
    L: "1",
    S: "5",
    B: "8",
  };
  s = s.replace(/[OILSB]/g, (c) => map[c] || c);
  s = s.replace(/-+/g, "-");
  return s;
}
const isLikelyUbic = (s: string) => UBIC_REGEX.test(s);

/* ==================================================================== */
/* ========================  ZPL helpers  ============================== */
/* ==================================================================== */
function mmToDots(mm: number, dpi: 203 | 300 | 600) {
  return Math.round((mm / 25.4) * dpi);
}

function escapeZplText(s: string) {
  return (s || "")
    .replace(/[\^~\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildZplForItem(
  a: { codigo: string; nombre: string; precio: number },
  template: { width: number; height: number },
  dpi: 203 | 300 | 600
) {
  const wDots = mmToDots(template.width, dpi);
  const hDots = mmToDots(template.height, dpi);

  // Márgenes físicos (mm → dots). Ajusta a tu gusto.
  const marginL = mmToDots(2, dpi);
  const marginT = mmToDots(2, dpi);
  const innerW = wDots - marginL - mmToDots(2, dpi);

  // ¿Tu diseño es vertical? rota 90° (R) y permuta PW/LL visualmente
  const isPortrait = template.height > template.width;
  const ori = isPortrait ? "R" : "N"; // N=normal, R=rotado 90°
  const PW = isPortrait ? hDots : wDots;
  const LL = isPortrait ? wDots : hDots;

  // Alturas (en mm → dots) pensadas para que escale según la etiqueta
  const bcHeight = mmToDots(
    Math.min(16, Math.max(8, template.height * 0.45)),
    dpi
  );
  const gap = mmToDots(1.5, dpi);

  // Tipografías (alto en dots, ZPL escalará el ancho)
  const fontDesc = mmToDots(
    Math.min(4, Math.max(2.3, template.height * 0.16)),
    dpi
  );
  const fontPrice = mmToDots(
    Math.min(6.5, Math.max(3.5, template.height * 0.26)),
    dpi
  );

  // Posiciones Y relativas
  const yBarcode = marginT;
  const yDesc = yBarcode + bcHeight + gap;
  const yPrice = yDesc + fontDesc + gap;

  const desc = escapeZplText(a.nombre);
  const price = a.precio != null ? `$${a.precio.toFixed(2)}` : "";
  const code = escapeZplText(a.codigo);

  // ^FB para envolver descripción dentro del ancho disponible
  //  ^FB<width>,<maxLines>,<lineSpacing>,<alignment>,<hangIndent>
  const fbWidth = Math.max(40, innerW);

  return `
^XA
^CI28
^PW${PW}
^LL${LL}
^LT0
^LS0
^PRB
^MD10
^LH0,0
^FO${marginL},${yBarcode}
^BY2,2
^BC${ori},${bcHeight},N,N,N
^FD${code}^FS
^FO${marginL},${yDesc}
^CF0,${fontDesc}
^FB${fbWidth},2,${mmToDots(0.6, dpi)},L,0
^FD${desc}^FS
^FO${marginL},${yPrice}
^CF0,${fontPrice}
^FD${price}^FS
^XZ`.trim();
}

function buildZplJob(
  articles: Array<{
    codigo: string;
    nombre: string;
    precio: number;
    quantity: number;
  }>,
  template: { width: number; height: number },
  dpi: 203 | 300 | 600
) {
  // Usa ^PQ para cantidad por artículo: 1 etiqueta = 1 ^XA…^XZ + ^PQn
  // (alternativa a concatenar N veces el mismo bloque)
  let out = "";
  for (const a of articles) {
    const unit = { codigo: a.codigo, nombre: a.nombre, precio: a.precio };
    const body = buildZplForItem(unit, template, dpi);
    const qty = Math.max(1, a.quantity);
    // Inserta ^PQ justo antes de ^XZ
    out += body.replace("^XZ", `^PQ${qty}\n^XZ`) + "\n";
  }
  return out;
}
// --- NUEVO: usa renderZPL del template si existe; si no, usa el fallback genérico ---
function buildZplJobSmart(
  articles: ArticleItem[],
  template: LabelTemplate,
  dpi: 203 | 300 | 600
) {
  const hasRenderZPL = typeof (template as any)?.renderZPL === "function";

  let out = "";
  for (const a of articles) {
    const qty = Math.max(1, a.quantity);

    // Si el template trae su propio ZPL, úsalo con el artículo completo
    const zplOne = hasRenderZPL
      ? (template as any).renderZPL(a, dpi)
      : buildZplForItem(
          { codigo: a.codigo, nombre: a.nombre, precio: a.precio ?? 0 },
          { width: template.width, height: template.height },
          dpi
        );

    out += String(zplOne).replace("^XZ", `^PQ${qty}\n^XZ`) + "\n";
  }
  return out;
}

// Compartir/descargar el ZPL en Android para abrir con Zebra Print Station
// Reemplaza tu shareZplToZebra por esta versión SIN async/await
function shareZplToZebra(zpl: string, name = `etiquetas_${Date.now()}.zpl`) {
  if (typeof window === "undefined") return;

  // 1) HTTPS / localhost obligatorio
  const isSecure =
    window.isSecureContext ||
    ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!isSecure) {
    alert("Esta función requiere HTTPS o localhost.");
    return;
  }

  // 2) Construir archivo (prueba con text/plain primero por compatibilidad)
  const blob = new Blob([zpl], { type: "text/plain" }); // <- IMPORTANTE
  const file = new File([blob], name, { type: "text/plain" });

  const nav: any = navigator;

  try {
    if (
      nav?.canShare &&
      nav.canShare({ files: [file] }) &&
      typeof nav.share === "function"
    ) {
      // LLAMADA DIRECTA, SIN await (user gesture)
      nav
        .share({
          title: "Zebra ZPL",
          text: "Abrir con Zebra Print",
          files: [file],
        })
        .catch(() => {
          // usuario canceló o no hubo destino => descarga
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        });
      return;
    }
  } catch (_) {
    // continúa al fallback
  }

  // 3) Fallback: descarga, luego abrir con “Zebra Print” desde el gestor
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==================================================================== */
// ====== BrowserPrint (Android) ======
declare global {
  interface Window {
    BrowserPrint?: any;
    Zebra?: any;
  }
}

async function ensureBrowserPrintLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  // ¿ya está alguno disponible?
  if (window.BrowserPrint || (window as any).Zebra?.BrowserPrint) return;

  // intentamos primero el namespaced y luego el legacy
  const candidates = [
    "/browserprint/BrowserPrint-3.1.250.min.js",
    "/browserprint/BrowserPrint-Zebra-1.1.250.min.js",
  ];

  for (const src of candidates) {
    // si ya lo cargamos, salimos
    if (window.BrowserPrint || (window as any).Zebra?.BrowserPrint) return;

    // evita insertar dos veces el mismo script
    if (document.querySelector(`script[data-bp="${src}"]`)) continue;

    await new Promise<void>((resolve) => {
      const s = document.createElement("script");
      s.async = true;
      s.dataset.bp = src;
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve(); // seguimos al siguiente candidato
      document.head.appendChild(s);
    });
  }

  if (!(window.BrowserPrint || (window as any).Zebra?.BrowserPrint)) {
    throw new Error("No se pudo cargar BrowserPrint (Zebra/legacy).");
  }
}

// helper para obtener la API sin preocuparte por la variante
async function getBP(): Promise<any> {
  await ensureBrowserPrintLoaded();
  const BP = window.BrowserPrint || (window as any).Zebra?.BrowserPrint;
  if (!BP) throw new Error("BrowserPrint no disponible");
  return BP;
}

async function bpIsAvailable(): Promise<boolean> {
  try {
    const BP = await getBP();
    return await new Promise<boolean>((res) => {
      try {
        BP.getDefaultDevice(
          "printer",
          (_d: any) => res(true),
          () => res(false)
        );
      } catch {
        res(false);
      }
    });
  } catch {
    return false;
  }
}

type ZebraDevice = {
  name: string;
  deviceType: "printer";
  uid?: string;
  connection?: string;
  write: (data: string, onOk?: () => void, onErr?: (e: any) => void) => void;
};

async function bpGetOrPickDevice(): Promise<ZebraDevice> {
  const BP = await getBP();

  // 1) intenta default
  const dflt: ZebraDevice | null = await new Promise((res) =>
    BP.getDefaultDevice(
      "printer",
      (d: ZebraDevice | null) => res(d),
      () => res(null)
    )
  );
  if (dflt) return dflt;

  // 2) lista
  const devices: ZebraDevice[] = await new Promise((res, rej) =>
    BP.getDevices(
      (list: ZebraDevice[]) => res(list || []),
      (err: any) => rej(err),
      "printer"
    )
  );

  // 3) respeta UID guardado, pero si falla, lo ignoramos
  const savedUid = localStorage.getItem("zebra_bp_uid");
  let dev = savedUid
    ? devices.find((d) => d.uid && d.uid === savedUid)
    : undefined;
  if (!dev)
    dev =
      devices.find((d) => /zq5|zebra|zq511/i.test(d.name || "")) || devices[0];

  if (!dev) throw new Error("No se encontró impresora en BrowserPrint");

  // guarda UID nuevo (si cambia)
  if (dev.uid && dev.uid !== savedUid)
    localStorage.setItem("zebra_bp_uid", dev.uid);
  return dev;
}

async function bpPrintZPL(zpl: string): Promise<void> {
  let firstAttempt = true;
  const tryOnce = async (): Promise<void> => {
    const dev = await bpGetOrPickDevice();

    // selector de método send/write
    const sendFn: (
      data: string,
      ok: () => void,
      err: (e: any) => void
    ) => void =
      typeof (dev as any).send === "function"
        ? (data, ok, err) => (dev as any).send(data, ok, err)
        : (data, ok, err) => dev.write(data, ok, err);

    // normaliza CRLF y fragmenta
    const payload = zpl.endsWith("\r\n")
      ? zpl
      : zpl.replace(/\n/g, "\r\n") + "\r\n";
    const CHUNK = 8 * 1024;
    const parts: string[] = [];
    for (let i = 0; i < payload.length; i += CHUNK)
      parts.push(payload.slice(i, i + CHUNK));

    // envoltorios connect/open/close si existen en esta versión del SDK
    const maybeConnect = (cb: () => void, onErr: (e: any) => void) => {
      const fn = (dev as any).connect || (dev as any).open;
      if (typeof fn === "function") {
        try {
          fn.call(dev, cb, onErr);
        } catch (e) {
          onErr(e);
        }
      } else cb();
    };
    const maybeClose = () => {
      const fn = (dev as any).disconnect || (dev as any).close;
      try {
        if (typeof fn === "function")
          fn.call(
            dev,
            () => {},
            () => {}
          );
      } catch {}
    };

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (f: () => void) => {
        if (!settled) {
          settled = true;
          f();
        }
      };

      // cadena de envío
      const sendNext = (i: number) => {
        if (i >= parts.length)
          return done(() => {
            maybeClose();
            resolve();
          });
        sendFn(
          parts[i],
          () => sendNext(i + 1),
          (e: any) =>
            done(() => {
              maybeClose();
              reject(e);
            })
        );
      };

      // wake + connect y luego enviar
      try {
        sendFn(
          "~HS\r\n",
          () => {},
          () => {}
        );
      } catch {}
      maybeConnect(
        () => {
          sendNext(0);
        },
        (e: any) =>
          done(() => {
            maybeClose();
            reject(e);
          })
      );

      setTimeout(
        () =>
          done(() => {
            maybeClose();
            reject(new Error("Timeout al enviar a BrowserPrint"));
          }),
        15000
      );
    });
  };

  try {
    await tryOnce();
  } catch (e: any) {
    // si falla en el primer intento, limpia UID y reintenta una vez
    if (firstAttempt) {
      firstAttempt = false;
      localStorage.removeItem("zebra_bp_uid");
      await tryOnce();
    } else {
      throw e;
    }
  }
}
/******************************************/

const testZPL = `^XA^CI28^FO40,40^A0N,40,40^FDTEST ZPL^FS^XZ`;
async function handleTestPrint() {
  try {
    await bpPrintZPL(testZPL);
    new Noty({
      type: "success",
      layout: "topRight",
      theme: "mint",
      text: "Test ZPL enviado.",
      timeout: 1800,
    }).show();
  } catch (e: any) {
    new Noty({
      type: "error",
      layout: "topRight",
      theme: "mint",
      text: "No se pudo conectar/enviar.",
      timeout: 2600,
    }).show();
    console.warn("bpPrint error:", e);
  }
}

/**************************************************************/

// ===========================================
export default function Page() {
  // Sucursal
  const [sucursalId, setSucursalId] = useState<string>("");
  useEffect(() => setSucursalId(localStorage.getItem("almacenId") || ""), []);
  useEffect(() => {
    if (sucursalId) localStorage.setItem("almacenId", sucursalId);
  }, [sucursalId]);
  const sucursalActual = useMemo(
    () => SCS.find((s) => s.id === sucursalId) || null,
    [sucursalId]
  );

  // Plantilla (desde registry)
  const [tplId, setTplId] = useState<TemplateId>(LABEL_TEMPLATES[0].id);
  const template = useMemo<LabelTemplate>(() => getTemplate(tplId), [tplId]);

  // Artículos
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [quantity, setQuantity] = useState("1");
  const [codigo, setCodigo] = useState("");
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const upsert = (item: ArticleItem) =>
    setArticles((prev) => {
      const i = prev.findIndex((a) => a.codigo === item.codigo);
      if (i !== -1) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + item.quantity };
        return next;
      }
      return [...prev, item];
    });
  const removeArticle = (id: string) =>
    setArticles((p) => p.filter((a) => a.id !== id));
  const resetArticles = () => {
    if (!articles.length) return;
    setArticles([]);
    new Noty({
      type: "success",
      layout: "topRight",
      theme: "mint",
      text: "Se eliminaron todos los artículos",
      timeout: 2000,
    }).show();
  };
  const totalLabels = useMemo(
    () => articles.reduce((s, a) => s + a.quantity, 0),
    [articles]
  );

  // Agregar por código (API tuya)
  const addByCodigo = async (cod: string, qtyOverride?: number) => {
    const clean = (cod || "").trim();
    if (!clean || !sucursalId) return;
    const qty =
      Number.isFinite(qtyOverride as number) && (qtyOverride as number) > 0
        ? (qtyOverride as number)
        : Math.max(1, parseInt(quantity || "1", 10));
    setLoadingAdd(true);
    setAddError(null);
    try {
      const r = await fetch(
        `/api/etiquetasPiso?codigo=${encodeURIComponent(
          clean
        )}&almacen=${encodeURIComponent(sucursalId)}`,
        { headers: { Accept: "application/json" } }
      );
      const j = await r.json();
      if (!r.ok || !j?.ok)
        throw new Error(j?.error || "No se pudo obtener el artículo.");
      const row = Array.isArray(j.data) ? j.data[0] : null;
      if (!row)
        throw new Error(
          "Sin resultados para ese código en el almacén seleccionado."
        );
      upsert({
        id: `${Date.now()}_${clean}`,
        codigo: clean,
        nombre: String(row.descripcion || "").trim() || "SIN DESCRIPCIÓN",
        unidad: String(row.unidad_venta || "-").trim(),
        precio: Number(row.precio_lista_iva ?? 0),
        distribuidor: Number(row.precio_mayor_iva ?? 0),
        fecha: todayMX(),
        estatus: (row.estatus ?? null) as string | null,
        inventarioMaximo: Number(row.inventario_maximo ?? 0),
        quantity: qty,
      });
      setCodigo("");
      setQuantity("1");
    } catch (e: any) {
      setAddError(e?.message || "Error al agregar el artículo.");
    } finally {
      setLoadingAdd(false);
    }
  };

  // Import/Export Excel
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    done: number;
    total: number;
  }>({ done: 0, total: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["CODIGO", "CANTIDAD"],
      ["12500", 2],
      ["12501", 1],
    ]);
    // @ts-ignore
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "plantilla_etiquetas_codigos.xlsx");
  };

  const importFromExcel = async (file: File) => {
    setImporting(true);
    setImportErrors([]);
    setImportProgress({ done: 0, total: 0 });
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: true,
        blankrows: false,
      }) as any[][];
      const data = rows.slice(1).map((r, i) => ({
        codigo: String(r[0] || "").trim(),
        qty: Math.max(1, parseInt(String(r[1] ?? "1"), 10)),
        i,
      }));
      const valid = data.filter((r) => r.codigo);
      const total = valid.length;
      setImportProgress({ done: 0, total });
      let done = 0;
      const errors: string[] = [];
      for (const r of valid) {
        try {
          await addByCodigo(r.codigo, r.qty);
        } catch (e: any) {
          errors.push(
            `Fila ${r.i + 2} (CODIGO=${r.codigo}): ${e?.message || "Error"}`
          );
        } finally {
          done++;
          setImportProgress({ done, total });
        }
      }
      setImportErrors(errors);
    } catch (e: any) {
      setImportErrors([e?.message || "No se pudo leer el archivo"]);
    } finally {
      setImporting(false);
    }
  };

  const exportArticlesExcel = async () => {
    if (!articles.length) {
      new Noty({
        type: "warning",
        layout: "topRight",
        theme: "mint",
        text: "No hay artículos para exportar.",
        timeout: 1800,
      }).show();
      return;
    }
    const data = [
      ["CODIGO", "CANTIDAD"],
      ...articles.map((a) => [a.codigo, a.quantity]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    // @ts-ignore
    ws["!cols"] = [{ wch: 16 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws, "Articulos");
    const suc = (sucursalActual?.nombre || "sucursal").replace(
      /[^\w\-]+/g,
      "_"
    );
    const fecha = new Date().toISOString().slice(0, 10);
    const filename = `articulos_codigos_${suc}_${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);
    new Noty({
      type: "success",
      layout: "topRight",
      theme: "mint",
      text: "Excel descargado.",
      timeout: 1800,
    }).show();
  };

  // ====== IMPRESIÓN ======
  // HTML → window.print() (se mantiene)
  const handlePrint = () => {
    if (!articles.length) return;
    const w = template.width;
    const h = template.height;
    const pad = template.id === "original-69x25" ? 3 : 0;
    const labelsHTML = articles
      .flatMap((a) =>
        Array.from({ length: a.quantity }, () => template.renderHTML(a))
      )
      .join("");
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Etiquetas</title>
<style>
${template.css(w, h, pad)}
@media print {
  .p{ break-after: page; }
  .p:last-of-type{ break-after: auto; }
  *{ font-family: Arial, Helvetica, sans-serif; }
}
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
<script>
  (function(){
    function renderBarcodes(){
      try{
        document.querySelectorAll('.jsb').forEach(function(el){
          var code = el.getAttribute('data-code')||'';
          var box = el.closest('.bc-fit') || el.closest('.q3');
          var hPx = 80;
          if (box) {
            var r = box.getBoundingClientRect();
            hPx = Math.max(20, Math.round(r.height));
          }
          JsBarcode(el, code, { format:'CODE128', displayValue:false, margin:0, height:hPx });
          el.removeAttribute('width'); el.removeAttribute('height');
          el.style.width='100%'; el.style.height='100%';
        });
      }catch(e){}
    }
    function renderQRCodes(){
      try{
        document.querySelectorAll('canvas.qr').forEach(function(c){
          var val = c.getAttribute('data-value') || '';
          var w = Math.max(40, Math.round((c.clientWidth || 0) || 140));
          QRCode.toCanvas(c, val, { errorCorrectionLevel: 'M', margin: 0, width: w });
        });
      }catch(e){}
    }
    window.addEventListener('load', function(){
      renderBarcodes();
      renderQRCodes();
      setTimeout(function(){ window.print(); }, 0);
    });
  })();
</script>
</head><body>${labelsHTML}</body></html>`;
    const f = document.createElement("iframe");
    Object.assign(f.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      opacity: "0",
    });
    document.body.appendChild(f);
    const d = (f.contentDocument || (f as any).ownerDocument) as Document;
    d.open();
    d.write(html);
    d.close();
    const cleanup = () => {
      try {
        document.body.removeChild(f);
      } catch {}
    };
    setTimeout(cleanup, 10000);
    (f.contentWindow as any)?.addEventListener?.("afterprint", cleanup);
  };

  // Smart print: BrowserPrint → HTML print
  type PrintPath = "browserprint" | "htmlPrint";
  function pickPrintPath(hasBP: boolean): PrintPath {
    return hasBP ? "browserprint" : "htmlPrint";
  }

  const handleSmartPrint = async () => {
    if (!articles.length) return;

    // Revalida BrowserPrint por si cambió
    let bpOk = false;
    try {
      bpOk = await bpIsAvailable();
    } catch {
      bpOk = false;
    }

    const path = pickPrintPath(bpOk);
    const zpl = buildZplJobSmart(articles, template, 203);

    const ok = (t: string) =>
      new Noty({
        type: "success",
        layout: "topRight",
        theme: "mint",
        text: t,
        timeout: 2200,
      }).show();
    const warn = (t: string) =>
      new Noty({
        type: "warning",
        layout: "topRight",
        theme: "mint",
        text: t,
        timeout: 2200,
      }).show();
    const err = (t: string) =>
      new Noty({
        type: "error",
        layout: "topRight",
        theme: "mint",
        text: t,
        timeout: 3000,
      }).show();

    const tryBrowserPrint = async () => {
      try {
        await bpPrintZPL(zpl);
        ok("Enviado a Zebra (BrowserPrint).");
        return true;
      } catch (e: any) {
        console.warn("BrowserPrint falló:", e);
        warn(
          "No se pudo usar BrowserPrint; abriré la impresión del navegador…"
        );
        return false;
      }
    };

    const tryHtmlPrint = () => {
      try {
        handlePrint();
        ok("Abriendo diálogo de impresión del navegador…");
        return true;
      } catch (e: any) {
        console.warn("HTML print falló:", e);
        err("No se pudo abrir la impresión del navegador.");
        return false;
      }
    };

    if (path === "browserprint") {
      if (await tryBrowserPrint()) return;
      tryHtmlPrint();
    } else {
      tryHtmlPrint();
    }
  };

  // Preview barcodes cuando lista/plantilla cambian
  useEffect(() => {
    (async () => {
      try {
        await ensureJsBarcodeLoaded();
        renderAllBarcodes();
      } catch {}
    })();
  }, [articles, tplId]);

  // ===== Modal buscar por ubicación + Cámara =====
  const [ubicModalOpen, setUbicModalOpen] = useState(false);
  const [ubicTab, setUbicTab] = useState<"manual" | "cam">("manual");
  const [ubicacion, setUbicacion] = useState("");
  const [buscandoUbic, setBuscandoUbic] = useState(false);
  const [ubicErr, setUbicErr] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Función eliminada - solo usamos BarcodeDetector nativo del navegador

  const startCamera = async () => {
    setUbicErr(null);
    try {
      stopCamera();
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = s;
      if (!videoRef.current) return;
      videoRef.current.srcObject = s;
      await videoRef.current.play();

      // @ts-ignore
      if ("BarcodeDetector" in window) {
        // @ts-ignore
        detectorRef.current = new window.BarcodeDetector({
          formats: [
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "qr_code",
          ],
        });
      } else {
        detectorRef.current = null;
        new Noty({
          type: "warning",
          layout: "topRight",
          theme: "mint",
          text: "Este navegador no soporta escaneo de códigos. Por favor, ingresa la ubicación manualmente.",
          timeout: 3500,
        }).show();
      }

      let missCount = 0;
      const tick = async () => {
        if (!videoRef.current) return;
        let candidate = "";

        if (detectorRef.current) {
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            candidate = String(codes?.[0]?.rawValue || "");
          } catch {
            /* noop */
          }
        }

        let normalized = normalizeCandidate(candidate);
        if (isLikelyUbic(normalized)) {
          setUbicacion(normalized);
          try {
            navigator.vibrate?.(80);
          } catch {}
          stopCamera();
          setUbicTab("manual");
          new Noty({
            type: "success",
            layout: "topRight",
            theme: "mint",
            text: `Ubicación: ${normalized}`,
            timeout: 1800,
          }).show();
          return;
        }

        // Fallback ZXing eliminado - solo usamos BarcodeDetector nativo
        // Si el navegador no soporta BarcodeDetector, el usuario debe ingresar manualmente

        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setUbicErr(e?.message || "No se pudo acceder a la cámara");
    }
  };

  useEffect(() => () => stopCamera(), []);

  // Buscar artículos por ubicación (API tuya)
  const buscarPorUbicacion = async () => {
    const u = (ubicacion || "").trim();
    if (!u) {
      setUbicErr("Ingresa una ubicación válida");
      return;
    }
    if (!sucursalId) {
      setUbicErr("Selecciona una sucursal primero");
      return;
    }
    setBuscandoUbic(true);
    setUbicErr(null);
    try {
      const url = `/api/etiquetasPiso?ubicacion=${encodeURIComponent(
        u
      )}&almacen=${encodeURIComponent(sucursalId)}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const j = await r.json();
      if (!r.ok || !j?.ok)
        throw new Error(j?.error || "No se pudo buscar por ubicación");
      const rows: any[] = Array.isArray(j.data) ? j.data : [];
      if (!rows.length) throw new Error("Sin artículos en esa ubicación");

      let added = 0;
      for (const row of rows) {
        const cod = String(row.codigo || row.CODIGO || row.id || "").trim();
        if (!cod) continue;
        upsert({
          id: `${Date.now()}_${cod}_${Math.random().toString(36).slice(2)}`,
          codigo: cod,
          nombre:
            String(row.descripcion || row.DESCRIPCION || "").trim() ||
            "SIN DESCRIPCIÓN",
          unidad: String(row.unidad_venta || row.UNIDAD || "-").trim(),
          precio: Number(row.precio_lista_iva ?? row.PRECIO ?? 0),
          distribuidor: Number(row.precio_mayor_iva ?? row.MAYOREO ?? 0),
          fecha: todayMX(),
          estatus: (row.estatus ?? row.ESTATUS ?? null) as string | null,
          inventarioMaximo: Number(row.inventario_maximo ?? row.INV_MAX ?? 0),
          quantity: 1,
        });
        added++;
      }
      new Noty({
        type: "success",
        layout: "topRight",
        theme: "mint",
        text: `Se agregaron ${added} artículos de la ubicación ${u}.`,
        timeout: 2500,
      }).show();
      setUbicModalOpen(false);
      setUbicacion("");
    } catch (e: any) {
      setUbicErr(e?.message || "Error al buscar por ubicación");
    } finally {
      setBuscandoUbic(false);
    }
  };

  const naturalW = mmToPx(template.width),
    naturalH = mmToPx(template.height);

  // ============= UI =============
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
      <style jsx global>{`
        input.no-spin::-webkit-outer-spin-button,
        input.no-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input.no-spin {
          -moz-appearance: textfield;
        }
        @supports (-webkit-touch-callout: none) {
          input,
          select,
          textarea,
          button {
            font-size: 16px;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area,
          #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: fixed;
            inset: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Dialog sucursal */}
      <Dialog open={!sucursalId} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md overflow-hidden rounded-2xl bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white border-white/10 shadow-2xl"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              Selecciona una sucursal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 relative z-10">
            <div className="space-y-2">
              <Label className="text-gray-100 font-medium">
                Sucursal
              </Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white w-full rounded-xl hover:bg-white/10 transition-colors">
                  <SelectValue placeholder="Elige una sucursal" />
                </SelectTrigger>
                <SelectContent className="bg-black/80 backdrop-blur-xl border-white/10">
                  {SCS.map((s) => (
                    <SelectItem
                      className="text-white hover:bg-white/10"
                      key={s.id}
                      value={s.id}
                    >
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (sucursalId) {
                  // El modal se cerrará automáticamente porque sucursalId ya no será null
                  console.log("Sucursal seleccionada:", sucursalId);
                }
              }}
              className="w-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 shadow-lg shadow-purple-500/20 rounded-xl transition-all duration-200"
              disabled={!sucursalId}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Buscar por ubicación */}
      <Dialog
        open={ubicModalOpen}
        onOpenChange={(open) => {
          setUbicModalOpen(open);
          if (!open) {
            stopCamera();
            setUbicTab("manual");
            setUbicErr(null);
          }
        }}
      >
        <DialogContent className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white border-white/10 shadow-2xl w-full max-w-[95vw] sm:max-w-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-4 h-4" /> Buscar por ubicación
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={ubicTab === "manual" ? "default" : "outline"}
                className={
                  ubicTab === "manual"
                    ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 shadow-lg shadow-purple-500/20 flex-1 sm:flex-none"
                    : "border-white/10 flex-1 sm:flex-none"
                }
                onClick={() => {
                  setUbicTab("manual");
                  stopCamera();
                }}
              >
                <Keyboard className="w-4 h-4 mr-2" /> Manual
              </Button>
              <Button
                variant={ubicTab === "cam" ? "default" : "outline"}
                className={
                  ubicTab === "cam"
                    ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30 hover:from-purple-500/40 hover:to-blue-500/40 shadow-lg shadow-purple-500/20 flex-1 sm:flex-none"
                    : "border-white/10 flex-1 sm:flex-none"
                }
                onClick={() => {
                  setUbicTab("cam");
                  startCamera();
                }}
              >
                <Camera className="w-4 h-4 mr-2" /> Cámara
              </Button>
            </div>

            {ubicTab === "manual" ? (
              <div className="space-y-3">
                <Label className="text-gray-100">
                  Ubicación / Anaquel / Pasillo
                </Label>
                <Input
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej. P8-LD-A7"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") buscarPorUbicacion();
                  }}
                />
                {ubicErr && (
                  <div className="px-3 py-2 text-sm text-red-300 flex items-center gap-2 bg-red-900/20 rounded">
                    <AlertCircle className="w-4 h-4" />
                    {ubicErr}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    className="border-gray-700 w-full sm:w-auto"
                    onClick={() => {
                      setUbicModalOpen(false);
                      stopCamera();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto"
                    onClick={buscarPorUbicacion}
                    disabled={buscandoUbic}
                  >
                    {buscandoUbic ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Buscar"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4 sm:p-6">
                <div className="relative aspect-[3/4] md:aspect-video w-full rounded-md overflow-hidden border border-gray-700 bg-black">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-contain"
                    muted
                    playsInline
                  />
                  {!streamRef.current && (
                    <div className="absolute inset-0 grid place-items-center text-gray-300 text-sm sm:text-base px-4 text-center">
                      <div>
                        <p>
                          Activa la cámara para escanear el anaquel / código de
                          ubicación.
                        </p>
                        <p className="opacity-80 mt-2">
                          Al detectar un código válido, lo copiaré arriba.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <Button
                    onClick={startCamera}
                    className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto h-11"
                  >
                    Iniciar cámara
                  </Button>
                  <Button
                    variant="outline"
                    className="border-gray-700 w-full sm:w-auto h-11"
                    onClick={stopCamera}
                  >
                    Detener
                  </Button>
                </div>

                {ubicacion && (
                  <div className="text-sm sm:text-base text-gray-200">
                    Detectado:{" "}
                    <span className="font-semibold text-purple-300 break-all">
                      {ubicacion}
                    </span>
                  </div>
                )}

                {ubicErr && (
                  <div className="px-3 py-2 text-sm sm:text-base text-red-300 flex items-start gap-2 bg-red-900/20 rounded">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span className="flex-1">{ubicErr}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    className="border-gray-700 w-full sm:w-auto h-11"
                    onClick={() => {
                      setUbicModalOpen(false);
                      stopCamera();
                    }}
                  >
                    Cerrar
                  </Button>
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 w-full sm:w-auto h-11"
                    onClick={buscarPorUbicacion}
                    disabled={!ubicacion || buscandoUbic}
                  >
                    {buscandoUbic ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Buscar con ubicación detectada"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contenido principal */}
      <div className="min-h-screen p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <p className="text-gray-200 text-base sm:text-lg">
              Sucursal actual:{" "}
              <span className="font-semibold text-purple-200">
                {sucursalActual ? sucursalActual.nombre : "—"}
              </span>
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch min-h-0">
            {/* Izquierda */}
            <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl h-full flex flex-col w-full">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
              <CardHeader className="relative border-b border-white/5 flex w-full justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="w-5 h-5 text-purple-300" />
                  Configuración
                </CardTitle>
                <CardTitle className="flex items-center gap-2 text-white font-light text-xs">
                  v2.4.0
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-gray-100 font-medium flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4" />
                      Tipo de etiqueta
                    </Label>
                    <Select value={tplId} onValueChange={setTplId}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors w-full">
                        <SelectValue placeholder="Elige una plantilla" />
                      </SelectTrigger>
                      <SelectContent className="bg-black/80 backdrop-blur-xl border-white/10">
                        {LABEL_TEMPLATES.map((t) => (
                          <SelectItem
                            className="text-white"
                            key={t.id}
                            value={t.id}
                          >
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      Dimensiones fijas: {template.width} × {template.height} mm
                    </p>
                  </div>

                  {/* Captura */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-gray-100 font-medium">
                      Código del artículo
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        type="text"
                        placeholder={
                          !sucursalId
                            ? "Selecciona una sucursal…"
                            : "Escanea o escribe el código…"
                        }
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            codigo.trim() &&
                            sucursalId
                          ) {
                            e.preventDefault();
                            addByCodigo(
                              codigo.trim(),
                              Math.max(1, parseInt(quantity || "1", 10))
                            );
                          }
                        }}
                        className="bg-white/5 border-white/10 text-white placeholder-gray-400 hover:bg-white/10 transition-colors flex-1 min-w-[200px]"
                        disabled={!sucursalId}
                      />
                      <div className="w-full sm:w-36">
                        <NumberField
                          value={quantity}
                          onChange={setQuantity}
                          min={1}
                          step={1}
                          ariaLabel="Número de impresiones"
                        />
                      </div>
                      <Button
                        onClick={() => {
                          if (codigo.trim() && sucursalId) {
                            addByCodigo(
                              codigo.trim(),
                              Math.max(1, parseInt(quantity || "1", 10))
                            );
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white border-0 w-full sm:w-auto"
                        disabled={!sucursalId || !codigo.trim() || loadingAdd}
                        title="Agregar etiqueta"
                      >
                        {loadingAdd ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    {addError && (
                      <div className="mt-2 px-3 py-2 text-sm text-red-300 flex items-center gap-2 bg-red-900/20 rounded">
                        <AlertCircle className="w-4 h-4" />
                        {addError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        new Noty({
                          type: "error",
                          layout: "topRight",
                          theme: "mint",
                          text: "El archivo es muy grande (máx 10 MB).",
                          timeout: 3000,
                        }).show();
                        e.currentTarget.value = "";
                        return;
                      }
                      try {
                        await importFromExcel(file);
                        new Noty({
                          type: "success",
                          layout: "topRight",
                          theme: "mint",
                          text: "Importación completada.",
                          timeout: 2500,
                        }).show();
                      } catch (err: any) {
                        new Noty({
                          type: "error",
                          layout: "topRight",
                          theme: "mint",
                          text: err?.message ?? "Error al importar el archivo.",
                          timeout: 3000,
                        }).show();
                      } finally {
                        e.currentTarget.value = "";
                      }
                    }}
                  />

                  {/* ÚNICO botón de impresión: BrowserPrint → HTML print */}
                  <Button
                    onClick={handleSmartPrint}
                    className="col-span-full w-full justify-center h-11 bg-purple-600 hover:bg-purple-700 text-white border-0"
                    disabled={!sucursalId || articles.length === 0}
                    title="Imprimir etiquetas"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir ({totalLabels})
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center h-10 sm:h-11 border-gray-600 text-white bg-transparent hover:bg-gray-700 hover:border-white"
                    onClick={downloadTemplate}
                    title="Descargar plantilla con solo CODIGO y CANTIDAD"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 mr-2 " />
                    <span>Descargar plantilla</span>
                  </Button>

                  <Button
                    type="button"
                    className="w-full justify-center h-10 sm:h-11 hover:bg-purple-600/20 bg-transparent text-purple-400/80 border border-purple-400/40 hover:text-white hover:border-purple-400"
                    disabled={!sucursalId || importing}
                    onClick={() => fileRef.current?.click()}
                    title="Importar desde Excel o CSV"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    )}
                    <span className="text-center">
                      {importing
                        ? `Importando ${importProgress.done}/${importProgress.total}`
                        : "Importar Excel"}
                    </span>
                  </Button>
                </div>

                <div className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center h-10 sm:h-11 text-gray-300 bg-transparent hover:bg-gray-700"
                    onClick={() => setUbicModalOpen(true)}
                    title="Buscar por ubicación"
                  >
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    <span>Por Ubicación</span>
                  </Button>
                </div>

                {(importing || importErrors.length > 0) && (
                  <div className="mt-3 space-y-2">
                    {importing && (
                      <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                        Procesando… {importProgress.done}/{importProgress.total}
                      </div>
                    )}
                    {importErrors.length > 0 && (
                      <div className="px-3 py-2 rounded bg-red-900/30 border border-red-700 text-red-200 text-sm max-h-40 overflow-y-auto">
                        <div className="flex items-center gap-2 font-medium mb-1">
                          <AlertCircle className="w-4 h-4" />
                          Errores de importación ({importErrors.length})
                        </div>
                        <ul className="list-disc ml-5 space-y-1">
                          {importErrors.slice(0, 50).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                        {importErrors.length > 50 && (
                          <div className="mt-1 opacity-80">…y más</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Derecha */}
            <div className="flex flex-col gap-4 sm:gap-6 h-full min-h-0">
              <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl flex-1 flex min-h-0">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                <CardHeader className="relative border-b border-white/5 shrink-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap min-w-0">
                    <CardTitle className="text-white truncate">
                      Artículos ({articles.length})
                    </CardTitle>

                    <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto min-w-0">
                      <Button
                        type="button"
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors w-full sm:w-auto"
                        disabled={articles.length === 0}
                        onClick={exportArticlesExcel}
                        title="Exportar artículos (CODIGO, CANTIDAD)"
                      >
                        <Download className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate">Exportar Excel</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetArticles}
                        disabled={articles.length === 0}
                        title="Eliminar todos los artículos"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>

                      <span className="text-sm text-purple-300 w-full sm:w-auto truncate">
                        Total: {totalLabels} etiquetas
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 max-w-full overflow-auto whitespace-wrap">
                  {articles.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>No hay artículos agregados</p>
                      <p className="text-sm">
                        Escribe un código y presiona Enter o el botón +
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[60vh] sm:max-h-[65vh]">
                      {articles.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors p-3 rounded-lg gap-3 min-w-0 border border-white/5"
                        >
                          <div className="flex-1 basis-0 min-w-0 overflow-hidden text-wrap sm:max-w-[100%] max-w-[300px]">
                            <p className="text-white font-medium truncate">
                              {a.nombre}
                            </p>
                            <p className="text-gray-300 text-xs sm:text-sm break-words">
                              Código:{" "}
                              <span className="break-all">{a.codigo}</span> •
                              Precio: {money(a.precio)} • Dist:{" "}
                              {money(a.distribuidor)} • Unidad: {a.unidad} •
                              Fecha: {a.fecha} • Estatus: {a.estatus ?? "-"} •
                              Inv. Máx:{" "}
                              {Number.isFinite(a.inventarioMaximo)
                                ? a.inventarioMaximo
                                : 0}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-purple-300 font-medium">
                              {a.quantity}x
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeArticle(a.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Preview */}
              <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-white/10 shadow-2xl flex-1 flex min-h-0 max-w-[100%]">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                <CardHeader className="relative border-b border-white/5 shrink-0">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Eye className="w-5 h-5 text-purple-300" />
                    Vista Previa
                  </CardTitle>
                  <p className="text-gray-300 text-sm">
                    Dimensiones fijas: {template.width}mm × {template.height}mm
                  </p>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 overflow-hidden max-w-[100%]">
                  <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 sm:p-8 flex-1 flex relative border border-white/5">
                    {articles.length === 0 ? (
                      <div className="m-auto text-center text-gray-400">
                        <p>Agrega artículos para ver la vista previa</p>
                      </div>
                    ) : (
                      <div className="w-full flex justify-center items-center overflow-auto">
                        <div
                          className="bg-white rounded-md shadow-lg border-2 border-gray-300 text-black"
                          style={{
                            width: "100%",
                            maxWidth: naturalW,
                            height: "auto",
                            aspectRatio: `${naturalW} / ${naturalH}`,
                            padding: 0,
                            overflow: "hidden",
                          }}
                        >
                          {/* SVGs .jsb se renderizan con JsBarcode en useEffect */}
                          {template.preview(articles[0])}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Área invisible para @media print (reutilizado por handlePrint) */}
      <div id="print-area" className="hidden" />
    </div>
  );
}

// ====== NumberField (simple) ======
function NumberField({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  id,
  className = "",
  inputClassName = "",
  ariaLabel,
}: {
  value: string | number;
  onChange: (val: string) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const parseVal = (v: string | number) =>
    (typeof v === "number" ? v : parseFloat(v || "0")) || 0;
  const bump = (d: 1 | -1) =>
    onChange(String(clamp(parseVal(value) + d * step)));
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5 ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        className="px-3 border-r border-white/10 rounded-none text-white hover:bg-white/10 transition-colors"
        aria-label="disminuir"
        onClick={() => bump(-1)}
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`no-spin bg-transparent border-0 text-white text-center focus-visible:ring-0 ${inputClassName}`}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
      />
      <Button
        type="button"
        variant="ghost"
        className="px-3 border-l border-white/10 rounded-none text-white hover:bg-white/10 transition-colors"
        aria-label="aumentar"
        onClick={() => bump(1)}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
