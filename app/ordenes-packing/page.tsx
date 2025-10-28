"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useCompany } from "@/lib/company-context"
import { Package, Calendar, Box, Search, ArrowUpDown, RefreshCw } from "lucide-react"
import { fetchJsonWithRetry } from "@/lib/fetch-with-retry"
import DashboardLayout from "@/components/layouts/dashboard-layout"

type OrdenPacking = {
  key: string
  id: string
  doctoId: number
  sistema: "PEDIDO" | "TRASPASO" | string
  cliente: string
  descripcion?: string | null
  fecha: string
  piezas?: number | null
  estado: "Pendiente"
}

export default function OrdenesPacking() {
  const router = useRouter()
  const { apiUrl } = useCompany()

  const [ordenes, setOrdenes] = useState<OrdenPacking[]>([])
  const [search, setSearch] = useState("")
  const [sortAsc, setSortAsc] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingInit, setLoadingInit] = useState(true)

  const baseURL = useMemo(() => (apiUrl || "").trim().replace(/\/+$/, ""), [apiUrl])

  const mapFromAPI = useCallback((rows: any[]): OrdenPacking[] => {
    const toIsoDate = (val: any) => {
      try {
        if (!val) return ""
        const d = new Date(val)
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, "0")
          const day = String(d.getDate()).padStart(2, "0")
          return `${y}-${m}-${day}`
        }
        return String(val)
      } catch {
        return String(val ?? "")
      }
    }

    return (rows || []).map((r: any, idx: number) => {
      const doctoId = Number(r?.R_DOCTO_ID ?? 0)
      const folio = String(r?.R_FOLIO ?? `DOC-${doctoId || idx}`)
      const cliente = String(r?.R_ALMACEN ?? "—")
      const desc = r?.R_DESCRIPCION ?? null
      const fecha = toIsoDate(r?.R_FECHA)
      const piezas = r?.R_PIEZAS ?? r?.PIEZAS ?? null
      const sistema = String(r?.R_SISTEMA ?? r?.SISTEMA ?? "")

      return {
        key: `${sistema || "S"}-${doctoId || idx}`,
        id: folio,
        doctoId: doctoId,
        sistema: sistema as any,
        cliente: cliente,
        descripcion: desc,
        fecha,
        piezas,
        estado: "Pendiente",
      }
    })
  }, [])

  const fetchOrdenes = useCallback(async () => {
    try {
      const url = `${baseURL}/ordenes`
      const json = await fetchJsonWithRetry(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      })
      
      if (!json?.ok) {
        throw new Error(json?.error || "Error en la respuesta del servidor")
      }

      const arr = Array.isArray(json?.ordenes) ? json.ordenes : []
      const mapped = mapFromAPI(arr)
      setOrdenes(mapped)
    } catch (err: any) {
      console.error("❌ fetchOrdenes:", err)
      // Silenciosamente falla para no mostrar error al usuario
      // Los reintentos ya se intentaron
    }
  }, [baseURL, mapFromAPI])

  useEffect(() => {
    ;(async () => {
      setLoadingInit(true)
      await fetchOrdenes()
      setLoadingInit(false)
    })()
  }, [fetchOrdenes])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrdenes()
    setRefreshing(false)
  }, [fetchOrdenes])

  const filteredSorted = useMemo(() => {
    const term = search.trim().toLowerCase()
    const f = ordenes.filter((o) => o.cliente.toLowerCase().includes(term) || o.id.toLowerCase().includes(term))
    return f.sort((a, b) => (sortAsc ? a.fecha.localeCompare(b.fecha) : b.fecha.localeCompare(a.fecha)))
  }, [ordenes, search, sortAsc])

  return (
    <DashboardLayout activeSection="PROCESOS" showHeader={false}>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white/90">Órdenes de Packing</h1>
            </div>

          {/* Search and Controls */}
          <div className="flex gap-3 items-center">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <input
                type="text"
                placeholder="Buscar orden o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/90 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
              />
            </div>

            {/* Sort Button */}
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/90 hover:bg-white/10 transition-all"
            >
              <ArrowUpDown className="h-5 w-5" />
              <span className="hidden sm:inline text-sm">{sortAsc ? "Antiguos" : "Recientes"}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/90 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loadingInit ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/20"></div>
          </div>
        ) : filteredSorted.length === 0 ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No hay órdenes disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSorted.map((item) => (
              <button
                key={item.key}
                onClick={() =>
                  router.push(
                    `/detalle-orden?doctoId=${item.doctoId}&sistema=${item.sistema}&orden=${encodeURIComponent(JSON.stringify(item))}`,
                  )
                }
                className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300 text-left"
              >
                {/* Icon and Status */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors">
                    <Package className="h-6 w-6 text-white/90" />
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-xs font-semibold text-amber-400 uppercase tracking-wide">
                    {item.estado}
                  </span>
                </div>

                {/* Order ID */}
                <h3 className="text-xl font-bold text-white/90 mb-2 group-hover:text-white transition-colors">
                  #{item.id}
                </h3>

                {/* Cliente */}
                <p className="text-base font-medium text-white/70 mb-3">{item.cliente}</p>

                {/* Description */}
                {item.descripcion && <p className="text-sm text-white/50 mb-4 line-clamp-2">{item.descripcion}</p>}

                {/* Footer Info */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Calendar className="h-4 w-4" />
                    <span>{item.fecha || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Box className="h-4 w-4" />
                    <span>{item.piezas ?? "—"} pzs</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}
