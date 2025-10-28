"use client"

import { useState, useEffect } from "react"
import { QrCode, Barcode, Check } from "lucide-react"

type CodeType = "qr" | "barcode"

export function GeneralFolios() {
  const [selectedType, setSelectedType] = useState<CodeType>("qr")
  const [isSaving, setIsSaving] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    // Marcar que estamos en el cliente
    setIsClient(true)
    
    // Cargar preferencia guardada
    try {
      const saved = localStorage.getItem("folioCodeType")
      if (saved === "qr" || saved === "barcode") {
        setSelectedType(saved)
      }
    } catch (error) {
      console.error("Error loading preference:", error)
    }
  }, [])

  const handleSave = (type: CodeType) => {
    setIsSaving(true)
    setSelectedType(type)
    
    try {
      localStorage.setItem("folioCodeType", type)
    } catch (error) {
      console.error("Error saving preference:", error)
    }
    
    setTimeout(() => {
      setIsSaving(false)
    }, 500)
  }

  if (!isClient) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-light tracking-wide text-white/90">Folios</h4>
        <p className="mt-1 text-sm font-light tracking-wide text-white/50">
          Gestión de folios del sistema
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h5 className="text-lg font-medium text-white/90 mb-4">
          Tipo de código para folios
        </h5>
        <p className="text-sm text-white/60 mb-6">
          Selecciona cómo deseas visualizar los códigos de los folios en el tablero
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción QR */}
          <button
            onClick={() => handleSave("qr")}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 ${
              selectedType === "qr"
                ? "border-purple-500 bg-purple-500/10"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {selectedType === "qr" && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                selectedType === "qr" ? "bg-purple-500/20" : "bg-white/10"
              }`}>
                <QrCode className={`w-8 h-8 ${
                  selectedType === "qr" ? "text-purple-400" : "text-white/60"
                }`} />
              </div>
              
              <div className="text-center">
                <h6 className="text-base font-medium text-white/90 mb-1">
                  Código QR
                </h6>
                <p className="text-xs text-white/50">
                  Escaneo rápido bidimensional
                </p>
              </div>
            </div>
          </button>

          {/* Opción Código de Barras */}
          <button
            onClick={() => handleSave("barcode")}
            className={`relative p-6 rounded-xl border-2 transition-all duration-200 ${
              selectedType === "barcode"
                ? "border-purple-500 bg-purple-500/10"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            }`}
          >
            {selectedType === "barcode" && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                selectedType === "barcode" ? "bg-purple-500/20" : "bg-white/10"
              }`}>
                <Barcode className={`w-8 h-8 ${
                  selectedType === "barcode" ? "text-purple-400" : "text-white/60"
                }`} />
              </div>
              
              <div className="text-center">
                <h6 className="text-base font-medium text-white/90 mb-1">
                  Código de Barras
                </h6>
                <p className="text-xs text-white/50">
                  Escaneo lineal tradicional
                </p>
              </div>
            </div>
          </button>
        </div>

        {isSaving && (
          <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 text-center">
              ✓ Preferencia guardada correctamente
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
