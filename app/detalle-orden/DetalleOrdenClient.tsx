"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { printLabels } from "@/lib/etiquetador-utils";
import { fetchJsonWithRetry, fetchWithRetry } from "@/lib/fetch-with-retry";

type DetalleItem = {
  articuloId: number;
  codigo?: string | null;
  codbar?: string | null;
  unidades?: number | null;
  packed?: number;
};

type Caratula = {
  folio?: string | null;
  fecha?: string | null;
  destino?: string | null;
  picker?: string | null;
};

type Toast = {
  id: number;
  message: string;
  type: "success" | "error";
};

type Caja = {
  CAJA_ID: number;
  NOMBRE: string;
  TIPO: string;
  CODIGO: string;
  CANT_USOS: number;
};

type CajaInstancia = {
  instanciaId: string;
  CAJA_ID: number;
  NOMBRE: string;
  TIPO: string;
  CODIGO: string;
  CANT_USOS: number;
};

type ArticuloEnCaja = {
  articuloId: number;
  codigo: string;
  cantidad: number;
};

export default function DetalleOrden() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiUrl } = useCompany();

  const doctoId = searchParams.get("doctoId");
  const sistema = searchParams.get("sistema");
  const orden = searchParams.get("orden");

  console.log("🔍 Parámetros de URL:", { doctoId, sistema, orden });

  const ordenData = useMemo(() => {
    try {
      const parsed = orden ? JSON.parse(orden) : null;
      console.log("📦 Datos de orden parseados:", parsed);
      return parsed;
    } catch (e) {
      console.error("❌ Error al parsear orden:", e);
      return null;
    }
  }, [orden]);

  const [loading, setLoading] = useState(true);
  const [caratula, setCaratula] = useState<Caratula | null>(null);
  const [detalles, setDetalles] = useState<DetalleItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [lastScannedIndex, setLastScannedIndex] = useState<number | null>(null);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [scannerValue, setScannerValue] = useState("");

  const [cajasSeleccionadas, setCajasSeleccionadas] = useState<CajaInstancia[]>(
    []
  );
  const [esperandoCaja, setEsperandoCaja] = useState(true);
  const [modoAgregarCaja, setModoAgregarCaja] = useState(false);

  const [cajaActivaId, setCajaActivaId] = useState<string | null>(null);
  const [articulosEnCajas, setArticulosEnCajas] = useState<{
    [instanciaId: string]: ArticuloEnCaja[];
  }>({});

  const [modalCajaId, setModalCajaId] = useState<string | null>(null);
  const scanningRef = useRef(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showRemisionCompletaModal, setShowRemisionCompletaModal] =
    useState(false);
  const [folioRemisionado, setFolioRemisionado] = useState<string>("");

  const scannerRef = useRef<HTMLInputElement>(null);

  const focusScanner = useCallback(() => {
    setTimeout(() => {
      scannerRef.current?.focus();
      scannerRef.current?.select();
    }, 10);
  }, []);

  const baseURL = useMemo(
    () => (apiUrl || "").trim().replace(/\/+$/, ""),
    [apiUrl]
  );

  const deconstructFolio = (folio: string): string => {
    if (!folio || folio.length !== 9) return folio;

    let lastLetterIndex = -1;
    for (let i = 0; i < folio.length; i++) {
      if (/[a-zA-Z]/.test(folio[i])) {
        lastLetterIndex = i;
      }
    }

    if (lastLetterIndex === -1) return folio;

    const letterPart = folio.substring(0, lastLetterIndex + 1);
    const numberPart = folio.substring(lastLetterIndex + 1);
    const numberWithoutZeros = numberPart.replace(/^0+/, "") || "0";

    return letterPart + numberWithoutZeros;
  };

  const showToast = (message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1000);
  };

  const playSound = (type: "check" | "wrong" | "success") => {
    const audio = new Audio(`/sounds/${type}.mp3`);
    audio.play().catch(() => {});
  };

  const validarCaja = async (codigo: string) => {
    try {
      const url = `${baseURL}/validar-caja`;
      const json = await fetchJsonWithRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CODIGO: codigo }),
      });

      if (!json?.ok) {
        playSound("wrong");
        showToast(json?.message || "Código de caja no encontrado", "error");
        return;
      }

      const caja = json.caja;

      const nuevaInstancia: CajaInstancia = {
        instanciaId: `${caja.CAJA_ID}-${Date.now()}`,
        CAJA_ID: caja.CAJA_ID,
        NOMBRE: caja.NOMBRE,
        TIPO: caja.TIPO,
        CODIGO: caja.CODIGO,
        CANT_USOS: caja.CANT_USOS,
      };

      setCajasSeleccionadas((prev) => {
        playSound("success");
        const count = prev.filter((c) => c.CAJA_ID === caja.CAJA_ID).length + 1;
        showToast(`${caja.NOMBRE} x${count}`, "success");

        if (prev.length === 0) {
          setCajaActivaId(nuevaInstancia.instanciaId);
        }

        return [...prev, nuevaInstancia];
      });

      setEsperandoCaja(false);
      setModoAgregarCaja(false);
    } catch (e: any) {
      console.error("❌ validarCaja:", e);
      playSound("wrong");
      showToast(e?.message || "Error al validar caja", "error");
    }
  };

  const fetchCaratula = useCallback(async () => {
    console.log("📞 Llamando a /caratula con:", { doctoId, sistema });
    const url = `${baseURL}/caratula?doctoId=${encodeURIComponent(
      String(doctoId)
    )}&sistema=${encodeURIComponent(String(sistema))}`;
    console.log("🔗 URL completa:", url);
    const resp = await fetch(url);
    const json = await resp.json();
    console.log("📦 Respuesta de /caratula:", json);
    if (!resp.ok || !json?.ok)
      throw new Error(json?.error || "Error al obtener carátula");
    const row = (json.caratula || [])[0] || {};
    console.log("📋 Fila de carátula:", row);
    setCaratula({
      folio: row.R_FOLIO ?? ordenData?.id ?? "",
      fecha: row.R_FECHA ?? ordenData?.fecha ?? "",
      destino: row.R_DESTINO ?? ordenData?.cliente ?? "",
      picker: row.R_PICKER ?? "",
    });
  }, [baseURL, doctoId, sistema, ordenData]);

  const fetchDetalles = useCallback(async () => {
    const url = `${baseURL}/detalles?doctoId=${encodeURIComponent(
      String(doctoId)
    )}&sistema=${encodeURIComponent(String(sistema))}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (!resp.ok || !json?.ok)
      throw new Error(json?.error || "Error al obtener detalles");
    const items: DetalleItem[] = (json.detalles || []).map((r: any) => ({
      articuloId: Number(r.R_ARTICULO_ID ?? 0),
      codigo: r.R_CODIGO ?? null,
      codbar: r.R_CODBAR ?? null,
      unidades: r.R_UNIDADES ?? 0,
      packed: 0,
    }));
    setDetalles(items);
  }, [baseURL, doctoId, sistema]);

  const loadAll = useCallback(async () => {
    if (!doctoId || !sistema) {
      showToast("Faltan parámetros para consultar la orden", "error");
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchCaratula(), fetchDetalles()]);
    } catch (e: any) {
      console.error("❌ detalleOrden loadAll:", e);
      showToast(e?.message || "No se pudo cargar la orden", "error");
    } finally {
      setLoading(false);
      focusScanner();
    }
  }, [doctoId, sistema, fetchCaratula, fetchDetalles, focusScanner]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const totalLineas = detalles.length;
  const lineasCompletas = detalles.filter(
    (d) => (d.unidades ?? 0) > 0 && (d.packed ?? 0) >= (d.unidades ?? 0)
  ).length;
  const totalRequeridas = detalles.reduce(
    (acc, d) => acc + (d.unidades ?? 0),
    0
  );
  const totalEmpacadas = detalles.reduce((acc, d) => acc + (d.packed ?? 0), 0);
  const progreso =
    totalRequeridas > 0 ? Math.min(1, totalEmpacadas / totalRequeridas) : 0;
  const todoListo =
    totalLineas > 0 &&
    lineasCompletas === totalLineas &&
    totalEmpacadas === totalRequeridas;

  const inc = (idx: number) => {
    setDetalles((prev) => {
      const next = [...prev];
      const d = next[idx];
      const req = d.unidades ?? 0;
      const pk = d.packed ?? 0;
      if (pk < req) {
        next[idx] = { ...d, packed: pk + 1 };
        setLastScannedIndex(idx);
        playSound("check");
      } else {
        playSound("wrong");
        showToast("Ya alcanzaste la cantidad requerida", "error");
      }
      return next;
    });
    focusScanner();
  };

  const dec = (idx: number) => {
    setDetalles((prev) => {
      const next = [...prev];
      const d = next[idx];
      const pk = d.packed ?? 0;
      if (pk > 0) next[idx] = { ...d, packed: pk - 1 };
      return next;
    });
    focusScanner();
  };

  const fillToRequired = (idx: number) => {
    setDetalles((prev) => {
      const next = [...prev];
      const d = next[idx];
      const req = d.unidades ?? 0;
      next[idx] = { ...d, packed: req };
      setLastScannedIndex(idx);
      return next;
    });
    focusScanner();
  };

  const processScan = (raw: string) => {
    if (scanningRef.current) {
      console.log("[v0] Scan blocked - already processing");
      return;
    }

    const code = (raw || "").trim().toUpperCase();
    if (!code) return;

    // "1" = caja chica, "2" = caja mediana, "3" = caja grande
    if (code === "1" || code === "2" || code === "3") {
      validarCaja(code);
      return;
    }

    if (esperandoCaja || modoAgregarCaja) {
      validarCaja(code);
      return;
    }

    console.log("[v0] Processing scan:", code);
    scanningRef.current = true;

    const idx = detalles.findIndex(
      (d) =>
        (d.codbar ?? "").toUpperCase() === code ||
        (d.codigo ?? "").toUpperCase() === code
    );

    if (idx >= 0) {
      const item = detalles[idx];
      const req = item.unidades ?? 0;
      const pk = item.packed ?? 0;

      if (pk < req) {
        setDetalles((prev) => {
          const next = [...prev];
          next[idx] = { ...item, packed: pk + 1 };
          return next;
        });

        setLastScannedIndex(idx);

        if (cajaActivaId !== null) {
          setArticulosEnCajas((prev) => {
            const updated = { ...prev };
            if (!updated[cajaActivaId]) {
              updated[cajaActivaId] = [];
            }

            const existingIndex = updated[cajaActivaId].findIndex(
              (a) => a.articuloId === item.articuloId
            );

            if (existingIndex >= 0) {
              console.log(
                "[v0] Incrementing existing article:",
                updated[cajaActivaId][existingIndex].codigo
              );
              updated[cajaActivaId] = updated[cajaActivaId].map((a, i) =>
                i === existingIndex ? { ...a, cantidad: a.cantidad + 1 } : a
              );
            } else {
              console.log(
                "[v0] Adding new article to box:",
                item.codigo || item.codbar
              );
              updated[cajaActivaId] = [
                ...updated[cajaActivaId],
                {
                  articuloId: item.articuloId,
                  codigo: item.codigo || item.codbar || "Sin código",
                  cantidad: 1,
                },
              ];
            }
            return updated;
          });
        }

        playSound("check");
        showToast("Producto escaneado correctamente", "success");
      } else {
        playSound("wrong");
        showToast("Ya alcanzaste la cantidad requerida", "error");
      }
    } else {
      playSound("wrong");
      showToast(`Código "${code}" no encontrado`, "error");
    }

    setTimeout(() => {
      scanningRef.current = false;
      console.log("[v0] Scan lock released");
    }, 100);
  };

  const confirmarPacking = async () => {
    if (!todoListo) {
      showToast(
        "Aún no completas todas las líneas o piezas requeridas",
        "error"
      );
      focusScanner();
      return;
    }
    try {
      const url = `${baseURL}/disponible?doctoId=${encodeURIComponent(
        String(doctoId)
      )}&sistema=${encodeURIComponent(String(sistema))}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok || !json?.ok)
        throw new Error(json?.error || "Error al verificar disponibilidad");
      if (!json.disponible) {
        showToast("Esta orden no está lista para empaque", "error");
        return;
      }

      playSound("success");
      setShowCompletionModal(true);
    } catch (e: any) {
      console.error("❌ confirmarPacking:", e);
      showToast(e?.message || "No se pudo confirmar", "error");
    }
  };

  const handleRecibir = async () => {
    if (!caratula?.folio) {
      showToast("No se encontró el folio de la orden", "error");
      return;
    }

    if (cajasSeleccionadas.length === 0) {
      showToast("No hay cajas seleccionadas", "error");
      return;
    }

    setIsPrinting(true);

    try {
      // 🆕 PASO 1: Ejecutar procedimiento REMISIONAR_PEDIDO_MEJORADO
      console.log(
        "🚀 Ejecutando procedimiento almacenado para folio:",
        caratula.folio
      );

      const folioDeconstruido = deconstructFolio(caratula.folio);
      console.log("📦 Folio deconstruido:", folioDeconstruido);

      // 🆕 Detectar tipo de documento por la primera letra del folio
      const primeraLetra = caratula.folio.charAt(0).toUpperCase();
      let tipoDocto = "P"; // Por defecto Pedido

      if (primeraLetra === "T") {
        tipoDocto = "T"; // Traspaso (TC, TP, etc.)
      } else if (primeraLetra === "P") {
        tipoDocto = "P"; // Pedido (PC)
      } else if (primeraLetra === "R") {
        tipoDocto = "R"; // Remisión
      }

      console.log(
        `📋 Tipo de documento detectado: ${tipoDocto} (primera letra: ${primeraLetra})`
      );

      const remisionarResp = await fetch(`${baseURL}/remisionar-pedido`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folio: folioDeconstruido,
          tipoDocto: tipoDocto,
        }),
      });

      const remisionarJson = await remisionarResp.json();

      if (!remisionarResp.ok || !remisionarJson?.ok) {
        throw new Error(
          remisionarJson?.message || "Error al remisionar el pedido"
        );
      }

      console.log("✅ Procedimiento almacenado ejecutado correctamente");
      showToast("Pedido remisionado correctamente", "success");

      // Guardar el folio y mostrar modal de remisión completa
      setFolioRemisionado(folioDeconstruido);
      setShowRemisionCompletaModal(true);
      setShowCompletionModal(false);
    } catch (e: any) {
      console.error("❌ handleRecibir:", e);
      showToast(e?.message || "Error al procesar el pedido", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const imprimirEtiquetas = async () => {
    setIsPrinting(true);
    try {
      // PASO 2: Obtener datos del folio para imprimir etiquetas (usar folio deconstruido)
      const folioResp = await fetch(
        `/api/buscar_folio?folio=${encodeURIComponent(folioRemisionado)}`
      );
      const folioJson = await folioResp.json();

      if (!folioResp.ok || !folioJson?.ok) {
        throw new Error(
          folioJson?.error || "No se pudo obtener los datos del folio"
        );
      }

      const folioData = Array.isArray(folioJson.data)
        ? folioJson.data[0]
        : folioJson.data;
      const tipoDetectado = folioJson.tipo || "factura";

      // PASO 3: Imprimir etiquetas
      await printLabels({
        folio: caratula?.folio || folioRemisionado,
        folioData,
        tipoDetectado,
        totalBoxes: cajasSeleccionadas.length,
      });

      playSound("success");
      showToast("Etiquetas impresas correctamente", "success");

      setTimeout(() => {
        setShowRemisionCompletaModal(false);
        router.push("/ordenes-packing");
      }, 1500);
    } catch (e: any) {
      console.error("❌ handleRecibir:", e);
      showToast(e?.message || "Error al procesar el pedido", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const productosVisibles = useMemo(() => {
    if (!showOnlyMissing) return detalles;
    return detalles.filter((item) => {
      const req = item.unidades ?? 0;
      const pk = item.packed ?? 0;
      return pk < req;
    });
  }, [detalles, showOnlyMissing]);

  const lastScannedItem =
    lastScannedIndex !== null ? detalles[lastScannedIndex] : null;

  useEffect(() => {
    const interval = setInterval(() => {
      if (
        document.activeElement !== scannerRef.current &&
        !showCompletionModal
      ) {
        focusScanner();
      }
    }, 100);

    const handleClick = () => {
      if (!showCompletionModal) {
        focusScanner();
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !showCompletionModal) {
        focusScanner();
      }
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", focusScanner);

    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", focusScanner);
    };
  }, [focusScanner, showCompletionModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F4 key
      if (e.key === "F4") {
        e.preventDefault();
        confirmarPacking();
      }
      // Alt + J
      if (e.altKey && e.key === "j") {
        e.preventDefault();
        confirmarPacking();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [todoListo, doctoId, sistema, baseURL, caratula?.folio]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white/20 mx-auto mb-4"></div>
          <p className="text-white/60 text-lg">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (esperandoCaja) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex items-center justify-center p-4">
        <input
          ref={scannerRef}
          type="text"
          value={scannerValue}
          onChange={(e) => setScannerValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              processScan(scannerValue);
              setScannerValue("");
              focusScanner();
            }
          }}
          onBlur={focusScanner}
          autoFocus
          autoComplete="off"
          className="absolute w-1 h-1 opacity-0 -z-10"
          style={{ caretColor: "transparent" }}
        />

        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-6 py-4 rounded-xl shadow-lg border animate-in slide-in-from-right backdrop-blur-xl ${
                toast.type === "success"
                  ? "bg-white/10 border-blue-500/50 text-blue-400"
                  : "bg-red-500/20 border-red-500/50 text-red-400"
              }`}
            >
              <p className="font-semibold">{toast.message}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-12 text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-900 to-purple-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-500/20">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-white/90 mb-4">
            Escanea una Caja
          </h2>
          <p className="text-xl text-white/60 mb-8">
            Antes de comenzar el empaque, escanea el código QR de la caja que
            utilizarás
          </p>
          <div className="flex items-center justify-center gap-3 text-white/40">
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
          <p className="text-sm text-white/40 mt-8">
            Escáner activo - Esperando código...
          </p>
        </div>
      </div>
    );
  }

  if (modoAgregarCaja) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <input
          ref={scannerRef}
          type="text"
          value={scannerValue}
          onChange={(e) => setScannerValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              processScan(scannerValue);
              setScannerValue("");
              focusScanner();
            }
          }}
          onBlur={focusScanner}
          autoFocus
          autoComplete="off"
          className="absolute w-1 h-1 opacity-0 -z-10"
          style={{ caretColor: "transparent" }}
        />

        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-6 py-4 rounded-xl shadow-lg border animate-in slide-in-from-right backdrop-blur-xl ${
                toast.type === "success"
                  ? "bg-white/10 border-blue-500/50 text-blue-400"
                  : "bg-red-500/20 border-red-500/50 text-red-400"
              }`}
            >
              <p className="font-semibold">{toast.message}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-12 text-center">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-900 to-purple-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-500/20">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-white/90 mb-4">
            Escanea Otra Caja
          </h2>
          <p className="text-xl text-white/60 mb-8">
            Escanea el código QR de la caja adicional
          </p>
          <div className="flex items-center justify-center gap-3 text-white/40 mb-8">
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
          <button
            onClick={() => {
              setModoAgregarCaja(false);
              focusScanner();
            }}
            className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white/90 font-semibold rounded-xl transition-all shadow-sm border border-white/10"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 flex flex-col overflow-hidden">
      <input
        ref={scannerRef}
        type="text"
        value={scannerValue}
        onChange={(e) => setScannerValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            processScan(scannerValue);
            setScannerValue("");
            focusScanner();
          }
        }}
        onBlur={focusScanner}
        autoFocus
        autoComplete="off"
        className="absolute w-1 h-1 opacity-0 -z-10"
        style={{ caretColor: "transparent" }}
      />

      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-6 py-4 rounded-xl shadow-lg border animate-in slide-in-from-right backdrop-blur-xl ${
              toast.type === "success"
                ? "bg-white/10 border-blue-500/50 text-blue-400"
                : "bg-red-500/20 border-red-500/50 text-red-400"
            }`}
          >
            <p className="font-semibold">{toast.message}</p>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 p-4 sm:p-6 lg:p-8 pb-2 sm:pb-3 lg:pb-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white/90 mb-2 sm:mb-3 truncate">
                Orden #{caratula?.folio ?? ordenData?.id ?? "—"}
              </h1>
              <p className="text-white/70 text-sm sm:text-base lg:text-lg truncate">
                Destino: {caratula?.destino ?? "—"}
              </p>
              <p className="text-white/50 text-sm">
                Picker: {caratula?.picker ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full lg:w-auto">
              <button
                onClick={() => setShowOnlyMissing(!showOnlyMissing)}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 rounded-xl text-sm sm:text-base font-semibold transition-all shadow-sm ${
                  showOnlyMissing
                    ? "bg-gradient-to-br from-blue-900 to-purple-900 text-white border border-blue-800/40"
                    : "bg-white/5 border border-white/10 text-white/90 hover:bg-white/10"
                }`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">
                  {showOnlyMissing ? "Ver Todos" : "Ver Faltantes"}
                </span>
                <span className="sm:hidden">
                  {showOnlyMissing ? "Todos" : "Faltantes"}
                </span>
              </button>
              <button
                onClick={focusScanner}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 bg-white/5 border border-white/10 rounded-xl text-white/90 text-sm sm:text-base font-semibold hover:bg-white/10 transition-all shadow-sm"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Escáner activo</span>
                <span className="sm:hidden">Escáner</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row min-h-0">
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-4 lg:pb-8 overflow-y-auto min-h-0">
          <div className="space-y-4">
            {productosVisibles.map((item, idx) => {
              const realIdx = detalles.indexOf(item);
              const req = item.unidades ?? 0;
              const pk = item.packed ?? 0;
              const isComplete = pk >= req && req > 0;
              const isLastScanned = realIdx === lastScannedIndex;
              const progress = req > 0 ? (pk / req) * 100 : 0;

              return (
                <div
                  key={realIdx}
                  className={`bg-white/5 backdrop-blur-sm border-2 rounded-2xl p-6 shadow-md transition-all duration-300 ${
                    isLastScanned
                      ? "border-blue-500 scale-[1.02] shadow-blue-500/20"
                      : isComplete
                      ? "border-white/20"
                      : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-white/90">
                          {item.codigo || item.codbar || "Sin código"}
                        </span>
                        {isComplete && (
                          <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-br from-blue-900 to-purple-900 text-white rounded-full text-sm font-semibold">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            Completo
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span>Artículo ID: {item.articuloId}</span>
                        {item.codbar && (
                          <span>Código de barras: {item.codbar}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => dec(realIdx)}
                        disabled={pk === 0}
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold text-xl shadow-md transition-all"
                      >
                        −
                      </button>
                      <div className="text-center min-w-[100px]">
                        <div className="text-4xl font-bold text-white/90">
                          {pk} / {req}
                        </div>
                        <div className="text-sm text-white/50">empacadas</div>
                      </div>
                      <button
                        onClick={() => inc(realIdx)}
                        disabled={pk >= req}
                        className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold text-xl shadow-md transition-all"
                      >
                        +
                      </button>
                      <button
                        onClick={() => fillToRequired(realIdx)}
                        disabled={pk >= req}
                        className="px-4 py-3 rounded-xl bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md transition-all"
                      >
                        Llenar
                      </button>
                    </div>
                  </div>

                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isComplete
                          ? "bg-gradient-to-r from-blue-500 to-purple-500"
                          : "bg-blue-500/60"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full lg:w-1/4 lg:min-w-[320px] lg:max-w-[400px] p-4 sm:p-6 lg:p-8 lg:pl-0 space-y-3 sm:space-y-4 lg:space-y-6 flex flex-col overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-blue-500/30 scrollbar-track-white/5 hover:scrollbar-thumb-blue-500/50">
          {/* Progress card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 text-center shadow-lg flex-shrink-0">
            <div className="text-5xl sm:text-6xl lg:text-7xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent mb-3">
              {Math.round(progreso * 100)}%
            </div>
            <p className="text-white/70 text-lg font-semibold mb-6">
              Progreso Total
            </p>
            <div className="flex items-center justify-between text-sm text-white/50 mb-2">
              <span>{lineasCompletas} completadas</span>
              <span>{totalLineas} total</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 shadow-sm"
                style={{ width: `${progreso * 100}%` }}
              />
            </div>
          </div>

          {/* Boxes section with scroll */}
          {cajasSeleccionadas.length > 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-lg flex-shrink-0 max-h-[300px] sm:max-h-[350px] lg:max-h-[400px] overflow-y-auto">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-900 to-purple-900 rounded-full flex items-center justify-center shadow-md">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white/90">
                  Cajas Seleccionadas
                </h3>
              </div>

              <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                {(() => {
                  const grouped = cajasSeleccionadas.reduce((acc, caja) => {
                    if (!acc[caja.CAJA_ID]) {
                      acc[caja.CAJA_ID] = [];
                    }
                    acc[caja.CAJA_ID].push(caja);
                    return acc;
                  }, {} as { [key: number]: CajaInstancia[] });

                  return Object.values(grouped).map((group) => {
                    const firstCaja = group[0];
                    const count = group.length;

                    return (
                      <div
                        key={firstCaja.CAJA_ID}
                        className="space-y-1.5 sm:space-y-2"
                      >
                        <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg">
                          <span className="text-sm sm:text-base font-bold text-white/90 truncate">
                            {firstCaja.NOMBRE}
                          </span>
                          <span className="text-sm sm:text-base text-white/70 font-bold ml-2">
                            x{count}
                          </span>
                        </div>
                        {group.map((caja, idx) => {
                          const isActive = cajaActivaId === caja.instanciaId;
                          const articulosEnCaja =
                            articulosEnCajas[caja.instanciaId] || [];
                          const totalArticulos = articulosEnCaja.reduce(
                            (sum, a) => sum + a.cantidad,
                            0
                          );

                          return (
                            <div
                              key={caja.instanciaId}
                              onClick={() => setCajaActivaId(caja.instanciaId)}
                              className={`p-2 sm:p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                isActive
                                  ? "bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/20"
                                  : "bg-white/5 border-white/10 hover:border-white/20"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                  {isActive && (
                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                  )}
                                  <span className="text-sm sm:text-base text-white/90 font-semibold truncate">
                                    {firstCaja.TIPO} #{idx + 1}
                                  </span>
                                </div>
                                <span className="text-xs sm:text-sm text-white/60 ml-2 flex-shrink-0">
                                  {totalArticulos} arts.
                                </span>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalCajaId(caja.instanciaId);
                                }}
                                className="w-full py-1.5 sm:py-2 bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm"
                              >
                                <svg
                                  className="w-3 h-3 sm:w-4 sm:h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                <span className="hidden sm:inline">
                                  Ver Material
                                </span>
                                <span className="sm:hidden">Ver</span>
                              </button>

                              {isActive && (
                                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-blue-400 font-semibold flex items-center gap-1">
                                  <svg
                                    className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  Caja activa
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>

              <button
                onClick={() => setModoAgregarCaja(true)}
                className="w-full py-2 sm:py-3 bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Añadir Otra Caja
              </button>
            </div>
          )}

          {/* Last scanned item */}
          {lastScannedItem && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 sm:p-4 lg:p-6 shadow-lg flex-shrink-0">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-blue-900 to-purple-900 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white/90">
                  Último Escaneado
                </h3>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white/90 truncate">
                  {lastScannedItem.codigo || lastScannedItem.codbar}
                </div>
                <div className="text-xs sm:text-sm text-white/60">
                  Artículo ID: {lastScannedItem.articuloId}
                </div>
                <div className="text-2xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent mt-2 sm:mt-3">
                  {lastScannedItem.packed} / {lastScannedItem.unidades}
                </div>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleRecibir}
            disabled={!todoListo}
            className={`w-full py-3 sm:py-4 lg:py-5 rounded-xl lg:rounded-2xl font-bold text-sm sm:text-base lg:text-lg shadow-lg transition-all flex-shrink-0 ${
              todoListo
                ? "bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 text-white shadow-blue-500/20"
                : "bg-white/5 text-white/30 cursor-not-allowed border border-white/10"
            }`}
          >
            {todoListo ? (
              <>
                <span className="hidden lg:inline">
                  ✓ Confirmar Packing (F4 / Alt+J)
                </span>
                <span className="hidden sm:inline lg:hidden">
                  ✓ Confirmar Packing
                </span>
                <span className="sm:hidden">✓ Confirmar</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Completa el empaque</span>
                <span className="sm:hidden">Completa empaque</span>
              </>
            )}
          </button>
        </div>
      </div>

      {modalCajaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            {(() => {
              const caja = cajasSeleccionadas.find(
                (c) => c.instanciaId === modalCajaId
              );
              const articulosEnCaja = articulosEnCajas[modalCajaId] || [];
              const totalArticulos = articulosEnCaja.reduce(
                (sum, a) => sum + a.cantidad,
                0
              );

              return (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center shadow-md">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white/90">
                          {caja?.NOMBRE}
                        </h3>
                        <p className="text-sm text-white/60">
                          Tipo: {caja?.TIPO}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setModalCajaId(null)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                    >
                      <svg
                        className="w-5 h-5 text-white/90"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                    <div className="text-sm text-white/60 mb-1">
                      Total de artículos en esta caja:
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      {totalArticulos}
                    </div>
                  </div>

                  {articulosEnCaja.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {articulosEnCaja.map((art) => (
                        <div
                          key={art.articuloId}
                          className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm"
                        >
                          <div>
                            <div className="font-bold text-white/90">
                              {art.codigo}
                            </div>
                            <div className="text-sm text-white/50">
                              ID: {art.articuloId}
                            </div>
                          </div>
                          <div className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            x{art.cantidad}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <svg
                        className="w-16 h-16 mx-auto mb-4 opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                      <p className="text-lg">
                        Esta caja aún no tiene artículos
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-12 text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-900 to-purple-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-blue-500/20">
              <svg
                className="w-16 h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white/90 mb-4">
              ¡Empaque Completado!
            </h2>
            <p className="text-xl text-white/60 mb-8">
              Todas las líneas han sido empacadas correctamente
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                <div className="text-sm text-white/60 mb-1">Orden</div>
                <div className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {caratula?.folio}
                </div>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="text-sm text-white/60 mb-1">Total de cajas</div>
                <div className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {cajasSeleccionadas.length}
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => {
                  setShowCompletionModal(false);
                  focusScanner();
                }}
                disabled={isPrinting}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white/90 font-bold text-lg rounded-xl transition-all shadow-sm border border-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleRecibir}
                disabled={isPrinting}
                className="flex-1 py-4 bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isPrinting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Confirmar Remisión
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRemisionCompletaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full p-12 text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-green-900 to-emerald-900 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
              <svg
                className="w-16 h-16 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-4xl font-bold text-white/90 mb-4">
              ¡Remisión Completa!
            </h2>
            <p className="text-xl text-white/60 mb-8">
              El pedido ha sido remisionado exitosamente
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                <div className="text-sm text-white/60 mb-1">
                  Folio Remisionado
                </div>
                <div className="text-2xl font-bold bg-gradient-to-br from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  {folioRemisionado}
                </div>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="text-sm text-white/60 mb-1">Total de cajas</div>
                <div className="text-2xl font-bold bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {cajasSeleccionadas.length}
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => {
                  setShowRemisionCompletaModal(false);
                  router.push("/ordenes-packing");
                }}
                disabled={isPrinting}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white/90 font-bold text-lg rounded-xl transition-all shadow-sm border border-white/10"
              >
                Salir
              </button>
              <button
                onClick={imprimirEtiquetas}
                disabled={isPrinting}
                className="flex-1 py-4 bg-gradient-to-br from-blue-900 to-purple-900 hover:from-blue-700 hover:to-purple-700 disabled:bg-white/5 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isPrinting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Imprimiendo...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    Ver Etiqueta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
