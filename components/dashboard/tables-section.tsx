"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  FileText,
  Truck,
  Download,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";

type Folio = {
  FOLIO_FORMATEADO: string;
  FECHA_ENTREGA: string;
  PROVEEDOR: string;
  NUMERO_ARTICULOS: number;
};

type Estadisticas = {
  total: number;
  pendientes: number;
  enProceso: number;
  completadas: number;
};

function QRCodeComponent({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white shadow-lg p-3">
      <QRCodeSVG
        value={value}
        size={150}
        level="M"
        fgColor="#000000"
        bgColor="#FFFFFF"
      />
    </div>
  );
}

function BarcodeComponent({ value }: { value: string }) {
  return (
    <div className="rounded-lg border border-gray-300 bg-white shadow-lg p-3">
      <Barcode
        value={value}
        format="CODE128"
        width={2}
        height={80}
        displayValue={true}
        background="#FFFFFF"
        lineColor="#000000"
        margin={0}
        fontSize={14}
      />
    </div>
  );
}

function CodeDisplay({
  value,
  type,
}: {
  value: string;
  type: "qr" | "barcode";
}) {
  if (type === "barcode") {
    return <BarcodeComponent value={value} />;
  }
  return <QRCodeComponent value={value} />;
}

function FolioRow({
  folio,
  onClick,
  codeType,
}: {
  folio: Folio;
  onClick?: () => void;
  codeType: "qr" | "barcode";
}) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      onClick={onClick}
      className="group bg-black/40 hover:bg-black/60 border-b border-white/5 last:border-b-0 p-6 sm:p-8 cursor-pointer transition-all duration-200"
    >
      {/* Desktop Layout */}
      <div className="hidden lg:flex items-center gap-8">
        {/* Folio */}
        <div className="flex-shrink-0 w-64">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/5 group-hover:bg-white/10 rounded-xl flex items-center justify-center transition-all duration-200">
              <FileText className="w-7 h-7 text-white/60 group-hover:text-white/90" />
            </div>
            <div>
              <h4 className="text-2xl font-bold text-white/90 group-hover:text-white transition-colors">
                {folio.FOLIO_FORMATEADO}
              </h4>
            </div>
          </div>
        </div>

        {/* Proveedor */}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-medium text-white/80 truncate">
            {folio.PROVEEDOR}
          </p>
        </div>

        {/* Fecha Entrega */}
        <div className="flex-shrink-0 w-48">
          <div className="flex items-center gap-3 text-base">
            <Calendar className="w-6 h-6 text-white/40" />
            <span className="text-white/90 font-medium">
              {formatDate(folio.FECHA_ENTREGA)}
            </span>
          </div>
        </div>

        {/* Código QR o Barras */}
        <div className="flex-shrink-0 flex justify-center">
          <CodeDisplay value={folio.FOLIO_FORMATEADO} type={codeType} />
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 w-12 flex justify-end">
          <ChevronRight className="w-7 h-7 text-white/30 group-hover:text-white/70 transition-colors" />
        </div>
      </div>

      {/* Mobile Layout (< 640px) - Código abajo */}
      <div className="sm:hidden space-y-5">
        {/* Info del folio */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-bold text-white/90">
              {folio.FOLIO_FORMATEADO}
            </h4>
            <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(folio.FECHA_ENTREGA)}</span>
            </div>
          </div>
        </div>

        {/* Proveedor */}
        <p className="text-base font-medium text-white/70 pl-16">
          {folio.PROVEEDOR}
        </p>

        {/* Código centrado */}
        <div className="flex justify-center pt-3">
          <CodeDisplay value={folio.FOLIO_FORMATEADO} type={codeType} />
        </div>
      </div>

      {/* Tablet Layout (640px - 1024px) - Código a la derecha */}
      <div className="hidden sm:flex lg:hidden items-start justify-between gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-white/60" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-bold text-white/90">
                {folio.FOLIO_FORMATEADO}
              </h4>
              <div className="flex items-center gap-2 text-sm text-white/60 mt-1">
                <Calendar className="w-5 h-5" />
                <span>{formatDate(folio.FECHA_ENTREGA)}</span>
              </div>
            </div>
          </div>
          <p className="text-base font-medium text-white/70 pl-16">
            {folio.PROVEEDOR}
          </p>
        </div>

        {/* Código a la derecha */}
        <div className="flex-shrink-0">
          <CodeDisplay value={folio.FOLIO_FORMATEADO} type={codeType} />
        </div>
      </div>
    </div>
  );
}

function TableHeaders({ codeType }: { codeType: "qr" | "barcode" }) {
  return (
    <div className="hidden lg:block px-8 py-5 border-b border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-8 text-sm font-semibold text-white/60 uppercase tracking-wider">
        <div className="flex-shrink-0 w-64">Folio</div>
        <div className="flex-1 min-w-0">Proveedor</div>
        <div className="flex-shrink-0 w-48">Fecha Entrega</div>
        <div className="flex-shrink-0 text-center min-w-[200px]">
          {codeType === "qr" ? "Código QR" : "Código de Barras"}
        </div>
        <div className="flex-shrink-0 w-12"></div>
      </div>
    </div>
  );
}

export default function FoliosBoardVertical() {
  const router = useRouter();
  const { apiUrl, isReady } = useCompany();

  const [folios, setFolios] = useState<Folio[]>([]);
  const [stats, setStats] = useState<Estadisticas>({
    total: 0,
    pendientes: 0,
    enProceso: 0,
    completadas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");

  const fetchFolios = async () => {
    if (!apiUrl) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchJsonWithRetry(
        `${apiUrl}/ordenes-compra-pendientes`
      );

      if (data.success) {
        setFolios(data.ordenes || []);
        setStats(
          data.estadisticas || {
            total: 0,
            pendientes: 0,
            enProceso: 0,
            completadas: 0,
          }
        );
      } else {
        throw new Error("Error al obtener folios");
      }
    } catch (err: any) {
      setError(err.message || "Error al cargar los datos");
      console.error("Error fetching folios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiUrl && isReady) {
      fetchFolios();
    }
  }, [apiUrl, isReady]);

  useEffect(() => {
    // Cargar preferencia de tipo de código (solo en cliente)
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("folioCodeType");
        if (saved === "qr" || saved === "barcode") {
          setCodeType(saved);
        }
      } catch (error) {
        console.error("Error loading code type preference:", error);
        // Mantener el valor por defecto "qr"
      }
    }
  }, []);

  const handleFolioClick = (folio: string) => {
    console.log("Navegar a folio:", folio);
    // router.push(`/detalle-orden?folio=${folio}`)
  };

  const handleRefresh = () => {
    fetchFolios();
  };

  const handleExport = () => {
    if (folios.length === 0) return;

    // Crear CSV
    const headers = ["Folio", "Fecha Entrega", "Proveedor", "Artículos"];
    const rows = folios.map((f) => [
      f.FOLIO_FORMATEADO,
      f.FECHA_ENTREGA,
      f.PROVEEDOR,
      f.NUMERO_ARTICULOS,
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );

    // Descargar
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `folios_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-white/60">Cargando folios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Error al cargar datos
          </h3>
          <p className="text-white/60 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="space-y-2 pb-4 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl lg:text-3xl font-semibold text-white">
                FOLIOS
              </h2>
              <p className="text-sm text-white/40 mt-1">
                Órdenes de compra pendientes
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-semibold text-white">
                  {stats.total}
                </p>
                <p className="text-xs text-white/40">Total</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-semibold text-white">
                  {stats.pendientes}
                </p>
                <p className="text-xs text-white/40">Pendientes</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-semibold text-white">
                  {stats.enProceso}
                </p>
                <p className="text-xs text-white/40">En Proceso</p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-semibold text-white">
                  {stats.completadas}
                </p>
                <p className="text-xs text-white/40">Completados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
          <TableHeaders codeType={codeType} />

          <div className="divide-y divide-white/5">
            {folios.length === 0 ? (
              <div className="p-12 text-center text-white/40">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No hay folios pendientes</p>
              </div>
            ) : (
              folios.map((folio, index) => (
                <FolioRow
                  key={`${folio.FOLIO_FORMATEADO}-${index}`}
                  folio={folio}
                  codeType={codeType}
                  onClick={() => handleFolioClick(folio.FOLIO_FORMATEADO)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
