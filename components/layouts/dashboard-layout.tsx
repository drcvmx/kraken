"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Sidebar from "@/components/dashboard/sidebar"
import DashboardHeader from "@/components/dashboard/dashboard-header"

interface DashboardLayoutProps {
  children: React.ReactNode
  activeSection?: string
  showHeader?: boolean
}

interface UserData {
  PIKER_ID: number
  NOMBRE: string
  USUARIO: string
  ESTATUS: string
  IMAGEN_COLAB?: string
  IMAGEN_COLAB_MIME?: string
  ROL: string
  MODULOS_KRKN: string
  MODULOS_KRKN_ARRAY: number[]
}

interface CompanyData {
  id: number
  codigo: string
  nombre: string
  apiUrl: string
  branding?: any
}

export default function DashboardLayout({ 
  children, 
  activeSection = "PERFIL",
  showHeader = true 
}: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const safeGetAndParse = (key: string) => {
      try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : null
      } catch (error) {
        console.error(`Error parsing ${key} from localStorage:`, error)
        return null
      }
    }

    const storedUserData = safeGetAndParse("userData")
    const storedCompanyData = safeGetAndParse("companyData")

    if (storedUserData && storedCompanyData) {
      setUserData(storedUserData)
      setCompanyData(storedCompanyData)
      setIsLoading(false)
    } else {
      router.replace("/")
    }
  }, [router])

  const handleSectionChange = (section: string) => {
    const s = section.toUpperCase()
    
    // Mapeo de secciones a rutas
    const sectionRoutes: Record<string, string> = {
      "LAYOUT": "/almacenes",
      "PERFIL": "/dashboard?section=PERFIL",
      "PERSONALIZAR": "/dashboard?section=PERSONALIZAR",
      "USUARIOS": "/dashboard?section=USUARIOS",
      "APLICACIONES": "/dashboard?section=APLICACIONES",
      "CATÁLOGOS": "/dashboard?section=CATÁLOGOS",
      "PROCESOS": "/dashboard?section=PROCESOS",
      "INVENTARIO": "/dashboard?section=INVENTARIO",
      "EMBARQUES": "/dashboard?section=EMBARQUES",
      "INTEGRACIONES": "/dashboard?section=INTEGRACIONES",
      "CONFIGURACION": "/dashboard?section=CONFIGURACION",
      "ADMIN": "/dashboard?section=ADMIN",
      "ADUANA": "/dashboard?section=ADUANA",
      "AUDITORÍA": "/dashboard?section=AUDITORÍA",
      "KPI'S": "/dashboard?section=KPI'S",
      "TABLEROS": "/dashboard?section=TABLEROS",
    }

    const route = sectionRoutes[s] || `/dashboard?section=${s}`
    router.push(route)
  }

  const handleLogout = () => {
    localStorage.removeItem("userData")
    localStorage.removeItem("companyData")
    router.replace("/login")
  }

  if (isLoading || !userData || !companyData) {
    return null
  }

  return (
    <div className="h-dvh w-screen bg-black flex overflow-hidden">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex min-h-0 flex-col">
        {showHeader && (
          <div className="shrink-0">
            <DashboardHeader 
              activeSection={activeSection}
              userName={userData.NOMBRE}
              userEmail={userData.USUARIO}
            />
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
