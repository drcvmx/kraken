"use client"

import { useState, useMemo } from "react"
import { Search, X, Package, MapPin, AlertTriangle, BarChart3, Grid3x3, Warehouse, Plus, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  WAREHOUSES,
  MOCK_INVENTORY,
  addRowToWarehouse,
  addColumnToWarehouse,
  type Rack,
  type InventoryItem,
} from "@/lib/warehouse-data"
import { AddWarehouseDialog } from "./add-warehouse-dialog"
import { RackConfigDialog } from "./rack-config-warehouse"
import DashboardLayout from "@/components/layouts/dashboard-layout"

export default function AlmacenesPage() {
  const router = useRouter()
  const [selectedWarehouse, setSelectedWarehouse] = useState("b1")
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightedRack, setHighlightedRack] = useState<string | null>(null)
  const [selectedRack, setSelectedRack] = useState<Rack | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRackConfigDialog, setShowRackConfigDialog] = useState(false)
  const [configRack, setConfigRack] = useState<Rack | null>(null)

  const currentWarehouse = WAREHOUSES.find((w) => w.id === selectedWarehouse)

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return MOCK_INVENTORY.filter(
      (item) =>
        item.warehouse === selectedWarehouse &&
        (item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())),
    )
  }, [searchQuery, selectedWarehouse])

  const stats = useMemo(() => {
    if (!currentWarehouse) return null

    const totalItems = currentWarehouse.racks.reduce((sum, rack) => {
      return sum + rack.inventory.reduce((itemSum, item) => {
        const inventoryItem = MOCK_INVENTORY.find((inv) => inv.code === item.code)
        return itemSum + (inventoryItem?.quantity || 0)
      }, 0)
    }, 0)

    const occupiedRacks = currentWarehouse.racks.filter((r) => r.inventory.length > 0).length
    const totalRacks = currentWarehouse.racks.length
    const occupancyRate = (currentWarehouse.currentOccupancy / currentWarehouse.totalCapacity) * 100

    const lowStockItems = MOCK_INVENTORY.filter(
      (item) => item.warehouse === selectedWarehouse && item.quantity <= item.minStock,
    ).length

    return {
      totalItems,
      occupiedRacks,
      totalRacks,
      occupancyRate,
      lowStockItems,
    }
  }, [currentWarehouse, selectedWarehouse])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() && searchResults.length > 0) {
      const firstResult = searchResults[0]
      setHighlightedRack(firstResult.rack)
      setIsSearching(true)

      setTimeout(() => {
        setIsSearching(false)
      }, 8000)
    } else {
      setHighlightedRack(null)
      setIsSearching(false)
    }
  }

  const handleRackClick = (rack: Rack) => {
    setConfigRack(rack)
    setShowRackConfigDialog(true)
  }

  const getRackColor = (rack: Rack) => {
    if (highlightedRack === rack.id && isSearching) {
      return "bg-yellow-400 border-yellow-500 shadow-[0_0_40px_rgba(250,204,21,1),0_0_80px_rgba(250,204,21,0.8),0_0_120px_rgba(250,204,21,0.6)] animate-[pulse_0.5s_ease-in-out_infinite] ring-8 ring-yellow-400/60 scale-125 z-50 brightness-150"
    }

    if (selectedZone && rack.zone !== selectedZone) {
      return "bg-zinc-900/30 border-zinc-800/40 opacity-20"
    }

    if (rack.occupancy === 0) {
      return "bg-zinc-800/50 border-zinc-700/60 hover:border-zinc-600/80"
    }

    return "bg-amber-700/80 border-amber-600/90 hover:border-amber-500 hover:shadow-lg hover:scale-105"
  }

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity <= item.minStock) return { color: "text-red-400", bg: "bg-red-500/10", label: "Bajo" }
    if (item.quantity >= item.maxStock) return { color: "text-orange-400", bg: "bg-orange-500/10", label: "Alto" }
    return { color: "text-green-400", bg: "bg-green-500/10", label: "Normal" }
  }

  const getColumnLabel = (colIndex: number) => {
    return `G${(colIndex + 1) * 2}`
  }

  const racksByRow = useMemo(() => {
    if (!currentWarehouse) return []
    const rows: Rack[][] = []
    for (let i = 0; i < currentWarehouse.layout.rows; i++) {
      rows.push(currentWarehouse.racks.slice(i * currentWarehouse.layout.cols, (i + 1) * currentWarehouse.layout.cols))
    }
    return rows
  }, [currentWarehouse, refreshKey])

  const handleAddRow = () => {
    if (selectedWarehouse && addRowToWarehouse(selectedWarehouse)) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  const handleAddColumn = () => {
    if (selectedWarehouse && addColumnToWarehouse(selectedWarehouse)) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  return (
    <DashboardLayout activeSection="LAYOUT" showHeader={false}>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900">

      {/* Warehouse Selection Bar */}
      <div className="border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="mx-auto max-w-[1920px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button
                onClick={() => router.push('/dashboard?section=LAYOUT')}
                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-300 group"
              >
                <ArrowLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-0.5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center">
                  <Warehouse className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-xl text-white">Almacén</h1>
                  <p className="text-xs text-gray-400">Sistema de gestión</p>
                </div>
              </div>

              <div className="flex gap-2">
                {WAREHOUSES.map((warehouse) => (
                  <button
                    key={warehouse.id}
                    onClick={() => {
                      setSelectedWarehouse(warehouse.id)
                      setSearchQuery("")
                      setHighlightedRack(null)
                      setSelectedRack(null)
                      setSelectedZone(null)
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      selectedWarehouse === warehouse.id
                        ? "bg-gradient-to-br from-purple-500/30 to-blue-500/30 text-white shadow-lg"
                        : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {warehouse.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-[400px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, nombre o categoría..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-10 text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setHighlightedRack(null)
                      setIsSearching(false)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowAddDialog(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 px-4 py-2 text-sm font-medium text-white transition-all hover:from-purple-500/40 hover:to-blue-500/40 shadow-lg"
              >
                <Plus className="h-4 w-4" />
                Añadir
              </button>
            </div>
          </div>

          {searchQuery && searchResults.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-4">
              <div className="mb-3 text-xs text-gray-400">{searchResults.length} resultado(s) encontrado(s)</div>
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((item) => (
                  <div
                    key={item.code}
                    onClick={() => {
                      setHighlightedRack(item.rack)
                      setIsSearching(true)
                      setTimeout(() => setIsSearching(false), 8000)
                    }}
                    className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-purple-500/30 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-zinc-700 px-2 py-0.5 font-mono text-xs text-white">
                            {item.code}
                          </span>
                          <span className="text-sm text-white">{item.name}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.rack} - Nivel {item.shelf}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {item.quantity} uds
                          </span>
                          <span className="rounded bg-zinc-700 px-2 py-0.5">{item.zone}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1920px] px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-3 space-y-4">
            {/* Statistics */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-zinc-400" />
                <h3 className="font-semibold text-white">Estadísticas</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>Ocupación Total</span>
                    <span>{stats?.occupancyRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${stats?.occupancyRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                    <div className="text-2xl font-bold text-white">{stats?.totalItems}</div>
                    <div className="mt-1 text-xs text-zinc-400">Total Items</div>
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                    <div className="text-2xl font-bold text-white">
                      {stats?.occupiedRacks}/{stats?.totalRacks}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">Racks Ocupados</div>
                  </div>
                </div>

                {stats && stats.lowStockItems > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-red-400">{stats.lowStockItems} artículos</div>
                      <div className="text-xs text-red-400/70">Stock bajo</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Zones Filter */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Grid3x3 className="h-5 w-5 text-zinc-400" />
                <h3 className="font-semibold text-white">Zonas</h3>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setSelectedZone(null)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                    selectedZone === null
                      ? "border-blue-600 bg-blue-600/20 text-white"
                      : "border-zinc-800 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  Todas las zonas
                </button>

                {currentWarehouse?.zones
                  .filter((z) => z.name !== "General")
                  .map((zone) => (
                    <button
                      key={zone.name}
                      onClick={() => setSelectedZone(zone.name === selectedZone ? null : zone.name)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                        selectedZone === zone.name
                          ? "border-blue-600 bg-blue-600/20 text-white"
                          : "border-zinc-800 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full bg-${zone.color}-500`} />
                        {zone.name}
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Legend */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-3 text-sm font-semibold text-white">Leyenda</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded border border-zinc-700/60 bg-zinc-800/50" />
                  <span className="text-xs text-zinc-400">Vacío</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded border border-amber-600/90 bg-amber-700/80" />
                  <span className="text-xs text-zinc-400">Con inventario</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-pulse rounded border border-yellow-500 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                  <span className="text-xs text-zinc-400">Búsqueda activa</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warehouse Grid */}
          <div className={selectedRack ? "col-span-6" : "col-span-9"}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">{currentWarehouse?.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Vista de planta • {currentWarehouse?.layout.rows} filas × {currentWarehouse?.layout.cols} columnas
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
              <div
                className="mb-2 ml-12 grid gap-1"
                style={{ gridTemplateColumns: `repeat(${currentWarehouse?.layout.cols || 1}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: currentWarehouse?.layout.cols || 0 }).map((_, colIndex) => (
                  <div key={colIndex} className="text-center text-xs font-medium text-zinc-500">
                    {getColumnLabel(colIndex)}
                  </div>
                ))}
              </div>

              <div className="relative flex items-start gap-2">
                {/* Row labels and grid container */}
                <div className="flex-1">
                  <div className="space-y-1">
                    {racksByRow.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex items-center gap-2">
                        <div className="w-8 text-center text-sm font-medium text-zinc-500">{rowIndex + 1}</div>

                        <div
                          className="grid flex-1 gap-1"
                          style={{
                            gridTemplateColumns: `repeat(${currentWarehouse?.layout.cols || 1}, minmax(0, 1fr))`,
                          }}
                        >
                          {row.map((rack) => (
                            <button
                              key={rack.id}
                              onClick={() => handleRackClick(rack)}
                              className={`group relative aspect-square rounded border-2 transition-all duration-300 cursor-pointer ${getRackColor(rack)}`}
                            >
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                                <div className="text-xs font-semibold text-white drop-shadow-lg">{rack.label}</div>

                                {rack.inventory.length > 0 && (
                                  <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-white/80">
                                    <Package className="h-2.5 w-2.5" />
                                    <span>{rack.inventory.length}</span>
                                  </div>
                                )}
                              </div>

                              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/70 group-hover:opacity-100">
                                <span className="text-[10px] font-medium text-white">Configurar rack</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="w-8" />
                    {/* <button
                      onClick={handleAddRow}
                      className="flex h-8 w-full items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 text-zinc-500 transition-all hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
                      title="Añadir fila"
                    >
                      <Plus className="h-4 w-4" />
                    </button> */}
                  </div>
                </div>

                <button
                  onClick={handleAddColumn}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-blue-700 bg-blue-600 font-medium text-white  transition-all hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400 relative top-60"
                  title="Añadir columna"
                  style={{ marginTop: "28px" }} // Align with first row
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Rack Details Sidebar */}
          {selectedRack && (
            <div className="col-span-3">
              <div className="sticky top-6 space-y-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-white">Detalles del Rack</h3>
                    <button
                      onClick={() => setSelectedRack(null)}
                      className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-800/50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-500" />
                      <span className="text-lg font-bold text-white">{selectedRack.label}</span>
                    </div>
                    <div className="text-xs text-zinc-400">
                      Zona: <span className="text-white">{selectedRack.zone}</span>
                    </div>
                    <div className="mt-2 text-xs text-zinc-400">
                      Ocupación:{" "}
                      <span className="text-white">
                        {selectedRack.occupancy.toFixed(0)}% ({selectedRack.inventory.length} items)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-white">Inventario ({selectedRack.inventory.length})</div>

                    {selectedRack.inventory.map((item) => {
                      const fullItem = MOCK_INVENTORY.find((i) => i.code === item.code)
                      if (!fullItem) return null

                      const status = getStockStatus(fullItem)

                      return (
                        <div
                          key={item.code}
                          className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3 transition-all hover:border-zinc-700 hover:bg-zinc-800"
                        >
                          <div className="mb-2 flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-1 font-mono text-xs text-zinc-400">{fullItem.code}</div>
                              <div className="text-sm font-medium text-white">{fullItem.name}</div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Nivel:</span>
                              <span className="text-white">{item.shelf}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Cantidad:</span>
                              <span className="font-medium text-white">{fullItem.quantity} uds</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Categoría:</span>
                              <span className="rounded bg-zinc-700 px-2 py-0.5 text-white">{fullItem.category}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">Estado:</span>
                              <span className={`rounded px-2 py-0.5 ${status.bg} ${status.color}`}>{status.label}</span>
                            </div>

                            <div className="mt-3 rounded border border-zinc-700 bg-zinc-900 p-2">
                              <div className="mb-1 text-[10px] text-zinc-500">Rango de Stock</div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400">
                                  Min: <span className="text-white">{fullItem.minStock}</span>
                                </span>
                                <span className="text-zinc-400">
                                  Max: <span className="text-white">{fullItem.maxStock}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddWarehouseDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => {
          // Refresh or update state if needed
        }}
      />

      <RackConfigDialog
        isOpen={showRackConfigDialog}
        rack={configRack}
        warehouseId={selectedWarehouse}
        onClose={() => {
          setShowRackConfigDialog(false)
          setConfigRack(null)
        }}
        onSuccess={() => {
          // Refresh or update state if needed
        }}
      />
      </div>
    </DashboardLayout>
  )
}
