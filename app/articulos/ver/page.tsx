"use client";

import type React from "react";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  Plus,
  Eye,
  Pencil,
  RefreshCw,
  GripVertical,
  Save,
  Upload,
  FileDown,
  FileUp,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  List,
  Grid3x3,
  Grid2x2,
  LayoutGrid,
} from "lucide-react";
import { CrearArticuloModal } from "@/components/crear-articulo-modal";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Added Popover for filter dropdown
import * as XLSX from "xlsx";
import { useOptimizedImage } from "@/hooks/use-optimized-image";

type Articulo = {
  ARTICULO_ID: number;
  NOMBRE: string;
  MARCA?: string | null;
  CLAVE_ARTICULO?: string | null;
  UNIDAD_VENTA: string;
  UNIDAD_COMPRA: string;
  PRECIO_LISTA: number;
  TIENE_IMAGEN?: number | boolean;
};

type ArticuloDetalle = {
  ARTICULO_ID: number;
  NOMBRE: string;
  MARCA: string | null;
  UNIDAD_VENTA: string;
  UNIDAD_COMPRA: string;
  PRECIO_LISTA: number;
  PRECIO_DISTRIBUIDOR?: number | null;
  LINEA?: string | null;
  CLAVE_ARTICULO?: string | null;
  CLAVE_BARRAS?: string | null;
  IMPUESTO?: string | null;
  ALMACEN?: string | null;
  LOCALIZACION?: string | null;
  TIENE_IMAGEN?: number | boolean;
  INVENTARIO_MINIMO?: number | null;
  PUNTO_REORDEN?: number | null;
  INVENTARIO_MAXIMO?: number | null;
  IMAGEN?: string | null; // Base64 image data
};

const PER_PAGE_OPTIONS = [15, 25, 50, 100];

type ColumnKey = "id" | "nombre" | "clave" | "unidad" | "precio" | "acciones";

type ColumnConfig = {
  key: ColumnKey;
  label: string;
  filterable: boolean;
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "id", label: "ID", filterable: false },
  { key: "nombre", label: "Nombre", filterable: true },
  { key: "clave", label: "Clave", filterable: true },
  { key: "unidad", label: "Unidad", filterable: true },
  { key: "precio", label: "Costo", filterable: true },
  { key: "acciones", label: "Acciones", filterable: false },
];

type FilterOperator =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "between";

type ColumnFilter = {
  operator: FilterOperator;
  value: string;
  value2?: string; // For "between" operator
};

export default function ArticulosPage() {
  const { apiUrl } = useCompany();

  const [items, setItems] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [columnFilters, setColumnFilters] = useState<
    Record<string, ColumnFilter>
  >({});

  const [sortColumn, setSortColumn] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(
    DEFAULT_COLUMNS.map((c) => c.key)
  );
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);

  const [selectedArticulos, setSelectedArticulos] = useState<Set<number>>(
    new Set()
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // View mode: list, small, medium, large
  type ViewMode = "list" | "small" | "medium" | "large";
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<ArticuloDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const [imageLoading, setImageLoading] = useState(false);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ArticuloDetalle>>({});
  const [saving, setSaving] = useState(false);
  const [lineasArticulos, setLineasArticulos] = useState<
    Array<{ LINEA_ARTICULO_ID: number; NOMBRE: string }>
  >([]);
  const [almacenes, setAlmacenes] = useState<
    Array<{ ALMACEN_ID: number; NOMBRE: string }>
  >([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Group modal state
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalBase, setGroupModalBase] = useState<string | null>(null);
  const [groupModalItems, setGroupModalItems] = useState<Articulo[]>([]);

  const fetchArticulos = async () => {
    if (!apiUrl) return;
    const base = apiUrl.replace(/\/+$/, "");
    const ac = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/artics`, {
        signal: ac.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.ok && Array.isArray(json.articulos)) {
        const uniqueItems = Array.from(
          new Map(
            (json.articulos as Articulo[]).map((item) => [
              item.ARTICULO_ID,
              item,
            ])
          ).values()
        );
        setItems(uniqueItems);
      } else {
        setError("Respuesta inesperada del servidor");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e?.message || "Error al cargar artículos");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticulos();
  }, [apiUrl]);

  const filtered = useMemo(() => {
    let result = items;

    // 1️⃣ PRIMERO: Aplicar búsqueda global (barra de búsqueda)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.NOMBRE.toLowerCase().includes(query) ||
          (item.CLAVE_ARTICULO || "").toLowerCase().includes(query) ||
          item.ARTICULO_ID.toString().includes(query)
      );
    }

    // 2️⃣ SEGUNDO: Aplicar filtros de columna
    result = result.filter((item) => {
      // Check each column filter
      for (const [columnKey, filter] of Object.entries(columnFilters)) {
        let fieldValue = "";

        switch (columnKey) {
          case "nombre":
            fieldValue = item.NOMBRE.toLowerCase();
            break;
          case "clave":
            fieldValue = (item.CLAVE_ARTICULO || "").toLowerCase();
            break;
          case "unidad":
            fieldValue = item.UNIDAD_VENTA.toLowerCase();
            break;
          case "precio":
            fieldValue = item.PRECIO_LISTA.toString();
            break;
          default:
            continue;
        }

        const filterValue = filter.value.toLowerCase();

        switch (filter.operator) {
          case "contains":
            if (!fieldValue.includes(filterValue)) return false;
            break;
          case "equals":
            if (fieldValue !== filterValue) return false;
            break;
          case "startsWith":
            if (!fieldValue.startsWith(filterValue)) return false;
            break;
          case "endsWith":
            if (!fieldValue.endsWith(filterValue)) return false;
            break;
          case "greaterThan":
            if (columnKey === "precio") {
              if (Number(fieldValue) <= Number(filter.value)) return false;
            }
            break;
          case "lessThan":
            if (columnKey === "precio") {
              if (Number(fieldValue) >= Number(filter.value)) return false;
            }
            break;
          case "between":
            if (columnKey === "precio" && filter.value2) {
              const num = Number(fieldValue);
              if (num < Number(filter.value) || num > Number(filter.value2))
                return false;
            }
            break;
        }
      }

      return true;
    });

    // Apply sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case "id":
            aVal = a.ARTICULO_ID;
            bVal = b.ARTICULO_ID;
            break;
          case "nombre":
            aVal = a.NOMBRE.toLowerCase();
            bVal = b.NOMBRE.toLowerCase();
            break;
          case "clave":
            aVal = (a.CLAVE_ARTICULO || "").toLowerCase();
            bVal = (b.CLAVE_ARTICULO || "").toLowerCase();
            break;
          case "unidad":
            aVal = a.UNIDAD_VENTA.toLowerCase();
            bVal = b.UNIDAD_VENTA.toLowerCase();
            break;
          case "precio":
            aVal = a.PRECIO_LISTA;
            bVal = b.PRECIO_LISTA;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, searchQuery, columnFilters, sortColumn, sortDirection]);

  // Helper to escape regex
  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Group items that end with a space + number (e.g. "ZUECOS CHEF NEGRO 29").
  // We detect the base either from CLAVE_ARTICULO or from NOMBRE so searches by name
  // (p. ej. "zuecos") will also return grouped results.
  const groupedFiltered = useMemo(() => {
    const seen = new Set<string>();
    const res: Array<Articulo & { GROUP_COUNT?: number }> = [];

    for (const it of filtered) {
      const clave = (it.CLAVE_ARTICULO || "").trim();
      const nombre = (it.NOMBRE || "").trim();

      // Try clave first, then nombre
      let m = clave.match(/^(.*\S)\s+(\d+)$/);
      if (!m) m = nombre.match(/^(.*\S)\s+(\d+)$/);

      if (!m) {
        // not matching pattern, include as-is
        res.push(it);
        continue;
      }

      const base = m[1];
      if (seen.has(base)) continue;
      seen.add(base);

      // find all items in filtered that match base + space + digits in either clave or nombre
      const group = filtered.filter((x) => {
        const k = (x.CLAVE_ARTICULO || "").trim();
        const n = (x.NOMBRE || "").trim();
        const rx = new RegExp(`^${escapeRegExp(base)}\\s+\\d+$`, "i");
        return rx.test(k) || rx.test(n);
      });

      if (group.length <= 1) {
        res.push(it);
      } else {
        const rep = { ...(group[0] as any) } as Articulo & {
          GROUP_COUNT?: number;
        };
        // normalize displayed clave/nombre to the base so UI shows the grouped label
        rep.CLAVE_ARTICULO = base;
        rep.NOMBRE = base;
        rep.GROUP_COUNT = group.length - 1;
        res.push(rep);
      }
    }

    return res;
  }, [filtered]);

  // searchResults ya no es necesario, la búsqueda se integró en 'filtered'

  const pageCount = Math.max(1, Math.ceil(groupedFiltered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return groupedFiltered.slice(start, start + perPage);
  }, [filtered, currentPage, perPage]);

  useEffect(() => {
    setPage(1);
  }, [perPage, columnFilters, sortColumn, sortDirection]); // Updated dependency

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2,
    }).format(n || 0);

  const verArticulo = (id: number) => {
    setSelectedId(id);
    setDetailModalOpen(true);
  };

  useEffect(() => {
    if (!detailModalOpen || !selectedId || !apiUrl) return;
    const base = apiUrl.replace(/\/+$/, "");
    const ac = new AbortController();
    (async () => {
      setLoadingDetalle(true);
      setErrorDetalle(null);
      setDetalle(null);
      try {
        const url = `${base}/artics/${encodeURIComponent(selectedId)}`;
        const res = await fetch(url, { cache: "no-store", signal: ac.signal });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(
            `HTTP ${res.status} ${res.statusText}${body ? ` • ${body}` : ""}`
          );
        }

        const json = await res.json();
        if (json?.ok && json.articulo) setDetalle(json.articulo);
        else throw new Error("Respuesta inesperada");
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setErrorDetalle(e?.message || "Error al cargar el artículo");
        }
      } finally {
        setLoadingDetalle(false);
      }
    })();

    return () => ac.abort();
  }, [detailModalOpen, selectedId, apiUrl]);

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedId(null);
    setDetalle(null);
    setErrorDetalle(null);
    setIsEditMode(false);
    setEditedData({});
    setImagePreview(null);
    setImageLoading(false); // Reset image loading state
  };

  useEffect(() => {
    if (detailModalOpen && selectedId) {
      setImageLoading(true);
    }
  }, [detailModalOpen, selectedId]);

  useEffect(() => {
    if (!isEditMode || !apiUrl) return;
    const base = apiUrl.replace(/\/+$/, "");

    Promise.all([
      fetch(`${base}/lineas-articulos`).then((r) => r.json()),
      fetch(`${base}/almacenes`).then((r) => r.json()),
    ])
      .then(([lineasRes, almacenesRes]) => {
        if (lineasRes?.ok) setLineasArticulos(lineasRes.lineas || []);
        if (almacenesRes?.ok) setAlmacenes(almacenesRes.almacenes || []);
      })
      .catch((e) => console.error("Error fetching dropdowns:", e));
  }, [isEditMode, apiUrl]);

  const handleEditClick = () => {
    if (!detalle) return;
    setIsEditMode(true);
    setEditedData({
      NOMBRE: detalle.NOMBRE,
      UNIDAD_VENTA: detalle.UNIDAD_VENTA,
      CLAVE_ARTICULO: detalle.CLAVE_ARTICULO || "",
      CLAVE_BARRAS: detalle.CLAVE_BARRAS || "",
      LOCALIZACION: detalle.LOCALIZACION || "",
      INVENTARIO_MINIMO: detalle.INVENTARIO_MINIMO ?? 0,
      PUNTO_REORDEN: detalle.PUNTO_REORDEN ?? 0,
      INVENTARIO_MAXIMO: detalle.INVENTARIO_MAXIMO ?? 0,
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setEditedData({ ...editedData, IMAGEN: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!apiUrl || !selectedId || !detalle) return;

    setSaving(true);
    const base = apiUrl.replace(/\/+$/, "");

    try {
      const updates: Promise<any>[] = [];

      // Update NOMBRE
      if (editedData.NOMBRE && editedData.NOMBRE !== detalle.NOMBRE) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/nombre`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: editedData.NOMBRE }),
          })
        );
      }

      // Update UNIDAD_VENTA
      if (
        editedData.UNIDAD_VENTA &&
        editedData.UNIDAD_VENTA !== detalle.UNIDAD_VENTA
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/unidad-venta`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ unidadVenta: editedData.UNIDAD_VENTA }),
          })
        );
      }

      // Update CLAVE_ARTICULO
      if (
        editedData.CLAVE_ARTICULO !== undefined &&
        editedData.CLAVE_ARTICULO !== detalle.CLAVE_ARTICULO
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/clave`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clave: editedData.CLAVE_ARTICULO }),
          })
        );
      }

      // Update CLAVE_BARRAS
      if (
        editedData.CLAVE_BARRAS !== undefined &&
        editedData.CLAVE_BARRAS !== detalle.CLAVE_BARRAS
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/codigo-barras`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigoBarras: editedData.CLAVE_BARRAS }),
          })
        );
      }

      // Update LOCALIZACION
      if (
        editedData.LOCALIZACION !== undefined &&
        editedData.LOCALIZACION !== detalle.LOCALIZACION
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/localizacion`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ localizacion: editedData.LOCALIZACION }),
          })
        );
      }

      // Update INVENTARIO_MINIMO
      if (
        editedData.INVENTARIO_MINIMO !== undefined &&
        editedData.INVENTARIO_MINIMO !== detalle.INVENTARIO_MINIMO
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/inventario-minimo`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventarioMinimo: editedData.INVENTARIO_MINIMO,
            }),
          })
        );
      }

      // Update PUNTO_REORDEN
      if (
        editedData.PUNTO_REORDEN !== undefined &&
        editedData.PUNTO_REORDEN !== detalle.PUNTO_REORDEN
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/punto-reorden`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ puntoReorden: editedData.PUNTO_REORDEN }),
          })
        );
      }

      // Update INVENTARIO_MAXIMO
      if (
        editedData.INVENTARIO_MAXIMO !== undefined &&
        editedData.INVENTARIO_MAXIMO !== detalle.INVENTARIO_MAXIMO
      ) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/inventario-maximo`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inventarioMaximo: editedData.INVENTARIO_MAXIMO,
            }),
          })
        );
      }

      // Update IMAGEN
      if (editedData.IMAGEN) {
        updates.push(
          fetch(`${base}/artics/${selectedId}/imagen`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imagen: editedData.IMAGEN }),
          })
        );
      }

      await Promise.all(updates);

      // Refresh data
      setIsEditMode(false);
      setEditedData({});
      setImagePreview(null);
      fetchArticulos();

      // Reload detail
      const res = await fetch(`${base}/artics/${selectedId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json.articulo) setDetalle(json.articulo);
      }
    } catch (e: any) {
      alert(`Error al guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (columnKey: ColumnKey) => {
    setDraggedColumn(columnKey);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === columnKey) return;

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(columnKey);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);

    setColumnOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  const getColumnConfig = (key: ColumnKey) =>
    DEFAULT_COLUMNS.find((c) => c.key === key)!;

  // Group modal helpers
  const openGroupModal = (base: string) => {
    if (!base) return;
    const members = items.filter((x) => {
      const k = (x.CLAVE_ARTICULO || "").trim();
      const n = (x.NOMBRE || "").trim();
      const rx = new RegExp(`^${escapeRegExp(base)}\\s+\\d+$`, "i");
      return rx.test(k) || rx.test(n);
    });
    setGroupModalBase(base);
    setGroupModalItems(members);
    setGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setGroupModalOpen(false);
    setGroupModalBase(null);
    setGroupModalItems([]);
  };

  const renderCell = (item: Articulo, columnKey: ColumnKey) => {
    switch (columnKey) {
      case "id":
        return (
          <span className="text-white/60 text-sm">#{item.ARTICULO_ID}</span>
        );
      case "nombre":
        return <span className="text-white text-sm">{item.NOMBRE}</span>;
      case "clave": {
        // If the item is a grouped representative, show the base clave and a small "y N más" line
        const groupCount = (item as any).GROUP_COUNT ?? 0;
        return (
          <div className="flex flex-col">
            <div className="font-mono text-sm">
              {item.CLAVE_ARTICULO || "—"}
            </div>
            {groupCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-slate-400">{`y ${groupCount} más`}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const base = item.CLAVE_ARTICULO || item.NOMBRE || "";
                    openGroupModal(base);
                  }}
                  className="text-xs text-cyan-300 hover:text-cyan-400"
                  aria-label={`Ver variantes de ${item.CLAVE_ARTICULO}`}
                >
                  Ver
                </button>
              </div>
            )}
          </div>
        );
      }
      case "unidad":
        return (
          <span className="text-white/70 text-sm">
            {item.UNIDAD_VENTA}/{item.UNIDAD_COMPRA}
          </span>
        );
      case "precio":
        return (
          <span className="text-white text-sm">
            {fmtMoney(item.PRECIO_LISTA)}
          </span>
        );
      case "acciones":
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => verArticulo(item.ARTICULO_ID)}
              className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paged.map((item) => item.ARTICULO_ID));
      setSelectedArticulos(allIds);
    } else {
      setSelectedArticulos(new Set());
    }
  };

  const handleSelectArticulo = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedArticulos);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedArticulos(newSelected);
  };

  const isAllSelected =
    paged.length > 0 &&
    paged.every((item) => selectedArticulos.has(item.ARTICULO_ID));
  const isSomeSelected =
    paged.some((item) => selectedArticulos.has(item.ARTICULO_ID)) &&
    !isAllSelected;

  const handleExportExcel = () => {
    const exportData = filtered.map((item) => {
      const row: any = {};

      columnOrder.forEach((columnKey) => {
        switch (columnKey) {
          case "id":
            row["ID"] = item.ARTICULO_ID;
            break;
          case "nombre":
            row["Nombre"] = item.NOMBRE;
            break;
          case "clave":
            row["Clave"] = item.CLAVE_ARTICULO || "";
            break;
          case "unidad":
            row["Unidad Venta"] = item.UNIDAD_VENTA;
            row["Unidad Compra"] = item.UNIDAD_COMPRA;
            break;
          case "precio":
            row["Precio Lista"] = item.PRECIO_LISTA;
            break;
        }
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Artículos");

    const date = new Date().toISOString().split("T")[0];
    const filename = `articulos_${date}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const handleSort = (columnKey: ColumnKey) => {
    if (columnKey === "acciones") return; // Don't sort actions column

    if (sortColumn === columnKey) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  return (
    <DashboardLayout activeSection="CATÁLOGOS" showHeader={false}>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
        {/* Header */}
        <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-purple-400" />
                <div>
                  <h1 className="text-2xl font-light tracking-wide text-white">
                    Artículos
                  </h1>
                  <p className="text-sm text-white/50 tracking-wide">
                    Catálogo general de productos
                    {selectedArticulos.size > 0 &&
                      ` • ${selectedArticulos.size} seleccionados`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    placeholder="Buscar artículos..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                    }}
                    className="pl-10 w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-purple-500/50"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSearchQuery("");
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* View Mode Selector */}
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("list")}
                    className={`h-8 w-8 ${
                      viewMode === "list"
                        ? "bg-purple-600 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                    title="Vista de lista"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("small")}
                    className={`h-8 w-8 ${
                      viewMode === "small"
                        ? "bg-purple-600 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                    title="Iconos pequeños"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("medium")}
                    className={`h-8 w-8 ${
                      viewMode === "medium"
                        ? "bg-purple-600 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                    title="Iconos medianos"
                  >
                    <Grid2x2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode("large")}
                    className={`h-8 w-8 ${
                      viewMode === "large"
                        ? "bg-purple-600 text-white"
                        : "text-white/60 hover:text-white"
                    }`}
                    title="Iconos grandes"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchArticulos}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear Artículo
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[1800px] mx-auto px-6 py-8">
          {loading && (
            <div className="flex items-center gap-3 text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando artículos...
            </div>
          )}

          {error && (
            <Card className="p-4 bg-red-500/10 border-red-500/20 backdrop-blur-xl">
              <p className="text-red-400 font-light tracking-wide">{error}</p>
            </Card>
          )}

          {!loading && !error && (
            <div className="space-y-4">
              {/* Excel import/export buttons */}
              <div className="flex justify-between items-center gap-3">
                <div className="text-white/60 text-sm">
                  {viewMode === "list"
                    ? "Vista de lista"
                    : viewMode === "small"
                    ? "Iconos pequeños"
                    : viewMode === "medium"
                    ? "Iconos medianos"
                    : "Iconos grandes"}
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      alert("Funcionalidad de importar en desarrollo")
                    }
                    className="bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-2"
                  >
                    <FileUp className="w-4 h-4" />
                    Importar Excel
                  </Button>
                  <Button
                    onClick={handleExportExcel}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Exportar Excel
                  </Button>
                </div>
              </div>

              {/* Conditional rendering based on view mode */}
              {viewMode === "list" ? (
                /* Table View */
                <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left px-4 py-3 w-12">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={handleSelectAll}
                              className="border-white/30 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                              aria-label="Seleccionar todos"
                            />
                          </th>
                          {columnOrder.map((columnKey) => {
                            const config = getColumnConfig(columnKey);
                            const hasFilter = columnFilters[columnKey];
                            const isSorted = sortColumn === columnKey;

                            return (
                              <th
                                key={columnKey}
                                draggable
                                onDragStart={() => handleDragStart(columnKey)}
                                onDragOver={(e) => handleDragOver(e, columnKey)}
                                onDragEnd={handleDragEnd}
                                className={`text-left px-4 py-3 text-white/70 font-light tracking-wide text-sm cursor-move hover:bg-white/5 transition ${
                                  columnKey === "acciones" ? "text-right" : ""
                                } ${
                                  draggedColumn === columnKey
                                    ? "opacity-50"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-2 justify-between">
                                  <div className="flex items-center gap-2">
                                    <GripVertical className="w-3 h-3 text-white/30" />
                                    {config.label}
                                    {columnKey !== "acciones" && (
                                      <button
                                        onClick={() => handleSort(columnKey)}
                                        className="p-1 rounded hover:bg-white/10 transition"
                                      >
                                        {isSorted ? (
                                          sortDirection === "asc" ? (
                                            <ArrowUp className="w-3.5 h-3.5 text-purple-400" />
                                          ) : (
                                            <ArrowDown className="w-3.5 h-3.5 text-purple-400" />
                                          )
                                        ) : (
                                          <ArrowUpDown className="w-3.5 h-3.5 text-white/30" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  {config.filterable && (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          className={`p-1 rounded hover:bg-white/10 transition ${
                                            hasFilter
                                              ? "text-purple-400"
                                              : "text-white/40"
                                          }`}
                                        >
                                          <Filter className="w-3.5 h-3.5" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-80 bg-zinc-900 border-white/10 text-white">
                                        <FilterPopover
                                          columnKey={columnKey}
                                          columnLabel={config.label}
                                          currentFilter={
                                            columnFilters[columnKey]
                                          }
                                          onApply={(filter) => {
                                            if (filter) {
                                              setColumnFilters({
                                                ...columnFilters,
                                                [columnKey]: filter,
                                              });
                                            } else {
                                              const newFilters = {
                                                ...columnFilters,
                                              };
                                              delete newFilters[columnKey];
                                              setColumnFilters(newFilters);
                                            }
                                          }}
                                          isNumeric={columnKey === "precio"}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {paged.length === 0 ? (
                          <tr>
                            <td
                              colSpan={columnOrder.length + 1}
                              className="px-4 py-8 text-center text-white/50"
                            >
                              No hay artículos que coincidan con los filtros
                            </td>
                          </tr>
                        ) : (
                          paged.map((item, idx) => (
                            <tr
                              key={item.ARTICULO_ID}
                              className={`border-b border-white/5 hover:bg-white/[0.02] transition ${
                                idx % 2 === 0 ? "bg-white/[0.01]" : ""
                              } ${
                                selectedArticulos.has(item.ARTICULO_ID)
                                  ? "bg-purple-500/5"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-4">
                                <Checkbox
                                  checked={selectedArticulos.has(
                                    item.ARTICULO_ID
                                  )}
                                  onCheckedChange={(checked) =>
                                    handleSelectArticulo(
                                      item.ARTICULO_ID,
                                      checked as boolean
                                    )
                                  }
                                  className="border-white/30 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                  aria-label={`Seleccionar ${item.NOMBRE}`}
                                />
                              </td>
                              {columnOrder.map((columnKey) => (
                                <td
                                  key={columnKey}
                                  className={`px-4 py-4 ${
                                    columnKey === "acciones" ? "text-right" : ""
                                  }`}
                                >
                                  {renderCell(item, columnKey)}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Grid View (Small, Medium, Large) */
                <div
                  className={`grid gap-4 ${
                    viewMode === "small"
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
                      : viewMode === "medium"
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  }`}
                >
                  {paged.map((item) => (
                    <ArticuloCard
                      key={item.ARTICULO_ID}
                      articulo={item}
                      onView={verArticulo}
                      apiUrl={apiUrl}
                      onOpenGroup={(base: string) => openGroupModal(base)}
                      size={viewMode}
                    />
                  ))}
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-white/50 text-sm">
                    Filas por página:
                  </span>
                  <select
                    value={perPage}
                    onChange={(e) => setPerPage(Number(e.target.value))}
                    className="h-9 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none"
                  >
                    {PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-white/50 text-sm">
                    {(currentPage - 1) * perPage + 1}–
                    {Math.min(currentPage * perPage, filtered.length)} de{" "}
                    {filtered.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-40 h-9 w-9"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-40 h-9 w-9"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <CrearArticuloModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            fetchArticulos();
          }}
        />

        {/* Detail Modal */}
        {detailModalOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeDetailModal}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 to-black shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                  <div className="text-white/80">
                    {detalle?.NOMBRE ?? "Artículo"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeDetailModal}
                    className="text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  <div className="p-6 border-r border-white/10 flex flex-col items-center justify-center bg-white/[0.02] gap-4">
                    <div className="w-full max-w-md aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40 relative">
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        </div>
                      )}

                      {imagePreview ? (
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          onLoad={() => setImageLoading(false)}
                        />
                      ) : selectedId && detalle?.TIENE_IMAGEN ? (
                        <img
                          key={selectedId}
                          src={`${apiUrl?.replace(
                            /\/+$/,
                            ""
                          )}/artics/${encodeURIComponent(selectedId)}/imagen`}
                          alt="Imagen del artículo"
                          className="w-full h-full object-contain"
                          onLoadStart={() => setImageLoading(true)}
                          onLoad={() => setImageLoading(false)}
                          onError={(e) => {
                            setImageLoading(false);
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
                          Sin imagen
                        </div>
                      )}
                    </div>

                    {isEditMode && (
                      <div className="w-full max-w-md">
                        <Label
                          htmlFor="image-upload"
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition text-white/70 hover:text-white">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">Cambiar imagen</span>
                          </div>
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </Label>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    {loadingDetalle && (
                      <div className="flex items-center gap-2 text-white/60">
                        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                      </div>
                    )}
                    {errorDetalle && (
                      <div className="rounded-md border border-red-500/20 bg-red-500/10 text-red-300 px-3 py-2">
                        {errorDetalle}
                      </div>
                    )}
                    {detalle && !loadingDetalle && !errorDetalle && (
                      <div className="space-y-4">
                        {isEditMode ? (
                          <div className="space-y-2">
                            <Label className="text-white/70">Nombre</Label>
                            <Input
                              value={editedData.NOMBRE || ""}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  NOMBRE: e.target.value,
                                })
                              }
                              className="bg-white/5 border-white/10 text-white"
                            />
                          </div>
                        ) : (
                          <div>
                            <h2 className="text-xl text-white font-light tracking-wide">
                              {detalle.NOMBRE}
                            </h2>
                            <p className="text-white/50">
                              {detalle.UNIDAD_VENTA}/{detalle.UNIDAD_COMPRA}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <InfoRow
                            label="Costo:"
                            value={fmtMoney(detalle.PRECIO_LISTA)}
                          />
                          {detalle.PRECIO_DISTRIBUIDOR != null && (
                            <InfoRow
                              label="Precio distribuidor"
                              value={fmtMoney(detalle.PRECIO_DISTRIBUIDOR || 0)}
                            />
                          )}
                          <InfoRow label="Línea" value={detalle.LINEA ?? "—"} />
                          <InfoRow
                            label="Impuesto"
                            value={detalle.IMPUESTO ?? "—"}
                          />

                          {isEditMode ? (
                            <>
                              <EditableField
                                label="SKU"
                                value={editedData.CLAVE_ARTICULO || ""}
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    CLAVE_ARTICULO: val,
                                  })
                                }
                              />
                              <EditableField
                                label="Código barras"
                                value={editedData.CLAVE_BARRAS || ""}
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    CLAVE_BARRAS: val,
                                  })
                                }
                              />
                              <InfoRow
                                label="Almacén"
                                value={detalle.ALMACEN ?? "—"}
                              />
                              <EditableField
                                label="Localización"
                                value={editedData.LOCALIZACION || ""}
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    LOCALIZACION: val,
                                  })
                                }
                              />
                              <EditableField
                                label="Inv. Mínimo"
                                type="number"
                                value={
                                  editedData.INVENTARIO_MINIMO?.toString() ||
                                  "0"
                                }
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    INVENTARIO_MINIMO: Number(val),
                                  })
                                }
                              />
                              <EditableField
                                label="Punto Reorden"
                                type="number"
                                value={
                                  editedData.PUNTO_REORDEN?.toString() || "0"
                                }
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    PUNTO_REORDEN: Number(val),
                                  })
                                }
                              />
                              <EditableField
                                label="Inv. Máximo"
                                type="number"
                                value={
                                  editedData.INVENTARIO_MAXIMO?.toString() ||
                                  "0"
                                }
                                onChange={(val) =>
                                  setEditedData({
                                    ...editedData,
                                    INVENTARIO_MAXIMO: Number(val),
                                  })
                                }
                              />
                              <div className="space-y-2">
                                <Label className="text-white/40 text-xs">
                                  Unidad Venta
                                </Label>
                                <Select
                                  value={
                                    editedData.UNIDAD_VENTA ||
                                    detalle.UNIDAD_VENTA
                                  }
                                  onValueChange={(val) =>
                                    setEditedData({
                                      ...editedData,
                                      UNIDAD_VENTA: val,
                                    })
                                  }
                                >
                                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PAR">PAR</SelectItem>
                                    <SelectItem value="PZA">PZA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </>
                          ) : (
                            <>
                              <InfoRow
                                label="SKU"
                                value={detalle.CLAVE_ARTICULO ?? "—"}
                              />
                              <InfoRow
                                label="Código barras"
                                value={detalle.CLAVE_BARRAS ?? "—"}
                              />
                              <InfoRow
                                label="Almacén"
                                value={detalle.ALMACEN ?? "—"}
                              />
                              <InfoRow
                                label="Localización"
                                value={detalle.LOCALIZACION ?? "—"}
                              />
                              {detalle.INVENTARIO_MINIMO != null && (
                                <InfoRow
                                  label="Inv. Mínimo"
                                  value={detalle.INVENTARIO_MINIMO}
                                />
                              )}
                              {detalle.PUNTO_REORDEN != null && (
                                <InfoRow
                                  label="Punto Reorden"
                                  value={detalle.PUNTO_REORDEN}
                                />
                              )}
                              {detalle.INVENTARIO_MAXIMO != null && (
                                <InfoRow
                                  label="Inv. Máximo"
                                  value={detalle.INVENTARIO_MAXIMO}
                                />
                              )}
                            </>
                          )}
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          {isEditMode ? (
                            <>
                              <Button
                                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                onClick={handleSave}
                                disabled={saving}
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4" />
                                    Guardar
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                className="text-white/70 hover:text-white hover:bg-white/10"
                                onClick={() => {
                                  setIsEditMode(false);
                                  setEditedData({});
                                  setImagePreview(null);
                                }}
                                disabled={saving}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
                                onClick={handleEditClick}
                              >
                                <Pencil className="w-4 h-4" />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                className="text-white/70 hover:text-white hover:bg-white/10"
                                onClick={closeDetailModal}
                              >
                                Cerrar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Group Modal: show SKUs that belong to the same base */}
        {groupModalOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={closeGroupModal}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-950 to-black shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                  <div className="text-white/80">
                    Variantes: {groupModalBase}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={closeGroupModal}
                    className="text-white/70"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="p-4 space-y-3">
                  {groupModalItems.length === 0 ? (
                    <div className="text-white/50">
                      No se encontraron variantes
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupModalItems.map((it) => (
                        <div
                          key={it.ARTICULO_ID}
                          className="flex items-center justify-between gap-4 p-3 rounded-md bg-white/3 border border-white/5"
                        >
                          <div className="text-sm text-white">
                            {it.CLAVE_ARTICULO || it.NOMBRE}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-white/60">
                              {fmtMoney(it.PRECIO_LISTA)}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                closeGroupModal();
                                verArticulo(it.ARTICULO_ID);
                              }}
                            >
                              Ver
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="text-white/40">{label}</span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-white/40 text-xs">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border-white/10 text-white h-9"
      />
    </div>
  );
}

function ArticuloCard({
  articulo,
  onView,
  apiUrl,
  onOpenGroup,
  size = "large",
}: {
  articulo: Articulo;
  onView: (id: number) => void;
  apiUrl: string | null;
  onOpenGroup?: (base: string) => void;
  size?: "small" | "medium" | "large";
}) {
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 2,
    }).format(n || 0);

  const imageSrc = articulo.TIENE_IMAGEN
    ? `${apiUrl?.replace(/\/+$/, "")}/artics/${encodeURIComponent(
        articulo.ARTICULO_ID
      )}/imagen`
    : null;

  const {
    imageUrl,
    loading: imageLoading,
    error: imageError,
    elementRef,
  } = useOptimizedImage(imageSrc, true);

  const isSmall = size === "small";
  const isMedium = size === "medium";
  const isLarge = size === "large";

  return (
    <Card
      className="bg-black/40 border-white/10 backdrop-blur-xl overflow-hidden hover:border-purple-500/50 transition cursor-pointer group"
      onClick={() => onView(articulo.ARTICULO_ID)}
    >
      <div
        ref={elementRef}
        className="aspect-square bg-black/60 relative overflow-hidden"
      >
        {imageLoading && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2
              className={`text-purple-400 animate-spin ${
                isSmall ? "w-4 h-4" : isMedium ? "w-5 h-5" : "w-6 h-6"
              }`}
            />
          </div>
        )}
        {imageUrl && !imageError ? (
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={articulo.NOMBRE}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <Package
              className={
                isSmall ? "w-6 h-6" : isMedium ? "w-8 h-8" : "w-12 h-12"
              }
            />
          </div>
        )}
      </div>
      <div
        className={
          isSmall
            ? "p-2 space-y-0.5"
            : isMedium
            ? "p-3 space-y-1"
            : "p-4 space-y-2"
        }
      >
        <h3
          className={`text-white font-medium group-hover:text-purple-400 transition ${
            isSmall
              ? "text-[10px] line-clamp-1"
              : isMedium
              ? "text-xs line-clamp-1"
              : "text-sm line-clamp-2"
          }`}
        >
          {articulo.NOMBRE}
        </h3>
        {(articulo as any).GROUP_COUNT > 0 && (
          <div className="flex items-center gap-1.5">
            <div
              className={`text-slate-400 ${isSmall ? "text-[9px]" : "text-xs"}`}
            >
              {`y ${(articulo as any).GROUP_COUNT} más`}
            </div>
            {!isSmall && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const base = articulo.CLAVE_ARTICULO || articulo.NOMBRE || "";
                  onOpenGroup?.(base);
                }}
                className="text-xs text-cyan-300 hover:text-cyan-400"
                aria-label={`Ver variantes de ${
                  articulo.CLAVE_ARTICULO || articulo.NOMBRE
                }`}
              >
                Ver
              </button>
            )}
          </div>
        )}
        {!isSmall && (
          <div
            className={`flex items-center justify-between text-white/50 ${
              isMedium ? "text-[10px]" : "text-xs"
            }`}
          >
            <span className="truncate">
              SKU: {articulo.CLAVE_ARTICULO || "—"}
            </span>
            {isLarge && (
              <span className="ml-1 shrink-0">
                {articulo.UNIDAD_VENTA}/{articulo.UNIDAD_COMPRA}
              </span>
            )}
          </div>
        )}
        <div
          className={`text-purple-400 font-semibold ${
            isSmall ? "text-[10px]" : isMedium ? "text-sm" : "text-lg"
          }`}
        >
          {fmtMoney(articulo.PRECIO_LISTA)}
        </div>
      </div>
    </Card>
  );
}

function FilterPopover({
  columnKey,
  columnLabel,
  currentFilter,
  onApply,
  isNumeric,
}: {
  columnKey: string;
  columnLabel: string;
  currentFilter?: ColumnFilter;
  onApply: (filter: ColumnFilter | null) => void;
  isNumeric?: boolean;
}) {
  const [operator, setOperator] = useState<FilterOperator>(
    currentFilter?.operator || "contains"
  );
  const [value, setValue] = useState(currentFilter?.value || "");
  const [value2, setValue2] = useState(currentFilter?.value2 || "");

  const operators: { value: FilterOperator; label: string }[] = isNumeric
    ? [
        { value: "equals", label: "Igual a" },
        { value: "greaterThan", label: "Mayor que" },
        { value: "lessThan", label: "Menor que" },
        { value: "between", label: "Entre" },
      ]
    : [
        { value: "contains", label: "Contiene" },
        { value: "equals", label: "Igual a" },
        { value: "startsWith", label: "Comienza con" },
        { value: "endsWith", label: "Termina con" },
      ];

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-white/70 text-xs mb-2">
          Filtrar {columnLabel}
        </Label>
      </div>

      <div className="space-y-2">
        <Label className="text-white/50 text-xs">Operador</Label>
        <Select
          value={operator}
          onValueChange={(val) => setOperator(val as FilterOperator)}
        >
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-white/50 text-xs">Valor</Label>
        <Input
          type={isNumeric ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ingrese valor..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {operator === "between" && (
        <div className="space-y-2">
          <Label className="text-white/50 text-xs">Valor 2</Label>
          <Input
            type="number"
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            placeholder="Valor máximo..."
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          onClick={() => {
            if (value.trim()) {
              onApply({ operator, value: value.trim(), value2: value2.trim() });
            }
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
          disabled={!value.trim() || (operator === "between" && !value2.trim())}
        >
          Aplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue("");
            setValue2("");
            onApply(null);
          }}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          Limpiar
        </Button>
      </div>
    </div>
  );
}
