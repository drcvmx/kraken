"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Inbox, LucideWarehouse, ScanBarcode, Box, ChevronRight, X, Plus, List } from "lucide-react"

interface ModuleCardProps {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  version: string
  onClick?: () => void
}

function ModuleCard({ title, description, icon: Icon, version, onClick }: ModuleCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-black/40 hover:bg-black/60 border-b border-white/5 last:border-b-0 p-6 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center gap-6">
        {/* Icon section */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-white/5 group-hover:bg-white/10 rounded-lg flex items-center justify-center transition-all duration-200">
            <Icon className="w-6 h-6 text-white/60 group-hover:text-white/90 transition-colors" />
          </div>
        </div>

        {/* Content section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-base font-medium text-white/90 group-hover:text-white transition-colors">{title}</h4>
            <span className="text-[10px] text-white/30 font-mono">{version}</span>
          </div>
          <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors line-clamp-1">
            {description}
          </p>
        </div>

        {/* Action section */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 text-white/30 group-hover:text-white/70 transition-colors">
            <span className="text-xs font-medium">Abrir</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CatalogsSection() {
  const router = useRouter()
  const [showArticulosModal, setShowArticulosModal] = useState(false)

  const handleAlmacenesClick = () => {
    router.push("/almacenes")
  }

  // const handleArticulosClick = () => {
  //   setShowArticulosModal(true)
  // }
 const handleArticulosClick = () => {
   router.push("/articulos/ver")
}
  const handlePickingClick = () => {
    router.push("/almacen")
  }

  const handlePackingClick = () => {
    router.push("/ordenes-packing")
  }

  const handleProveedoresClick = () => {
    router.push("/proveedores")
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-1 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-semibold text-white">Catálogos</h2>
          <p className="text-sm text-white/40">Gestiona tus operaciones de almacén</p>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3 px-6">
              Módulos Principales
            </h3>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                 <ModuleCard
                title="Almacenes oficial"
                description="Registra la entrada de mercancía, valida contra órdenes de compra y asegura cantidades correctas."
                icon={Inbox}
                version="v2.1.0"
                onClick={handlePickingClick}
              />
              <ModuleCard
                title="Artículos"
                description="Ubica y organiza la mercancía recibida en su posición correcta dentro del almacén."
                icon={LucideWarehouse}
                version="v2.1.0"
                onClick={handleArticulosClick}
              />
              {/* <ModuleCard
                title="Clientes"
                description="Prepara los productos solicitados tomando la mercancía de su ubicación en almacén."
                icon={ScanBarcode}
                version="v2.1.0"
                onClick={handlePickingClick}
              /> */}
              {/* <ModuleCard
                title="Empresas"
                description="Empaca y consolida los productos seleccionados para el envío o entrega."
                icon={Box}
                version="v2.1.0"
                onClick={handlePackingClick}
              /> */}
               {/* <ModuleCard
                title="Ordenes de Compra"
                description="Empaca y consolida los productos seleccionados para el envío o entrega."
                icon={Box}
                version="v2.1.0"
                onClick={handlePackingClick}
              /> */}
               {/* <ModuleCard
                title="Pedidos"
                description="Empaca y consolida los productos seleccionados para el envío o entrega."
                icon={Box}
                version="v2.1.0"
                onClick={handlePackingClick}
              /> */}
               {/* <ModuleCard
                title="Proveedores"
                description="Empaca y consolida los productos seleccionados para el envío o entrega."
                icon={Box}
                version="v2.1.0"
                onClick={handleProveedoresClick}
              /> */}
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Artículos */}
      {showArticulosModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-white/10 rounded-xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="text-lg font-semibold text-white">Artículos</h3>
                <p className="text-sm text-white/40 mt-1">Selecciona una opción</p>
              </div>
              <button
                onClick={() => setShowArticulosModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Options */}
            <div className="p-4">
              <button
                onClick={() => {
                  setShowArticulosModal(false)
                  router.push("/articulos/ver")
                }}
                className="w-full group bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-lg p-4 mb-3 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 group-hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">
                    <List className="w-5 h-5 text-white/60 group-hover:text-white/90 transition-colors" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                      Ver Artículos
                    </h4>
                    <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors mt-0.5">
                      Lista de todos los artículos
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
                </div>
              </button>

              <button
                onClick={() => {
                  setShowArticulosModal(false)
                  router.push("/articulos/crear")
                }}
                className="w-full group bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded-lg p-4 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/5 group-hover:bg-white/10 rounded-lg flex items-center justify-center transition-all">
                    <Plus className="w-5 h-5 text-white/60 group-hover:text-white/90 transition-colors" />
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                      Crear Artículo
                    </h4>
                    <p className="text-xs text-white/40 group-hover:text-white/60 transition-colors mt-0.5">
                      Agregar un nuevo artículo
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}