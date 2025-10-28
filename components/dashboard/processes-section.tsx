"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  LucideWarehouse,
  ScanBarcode,
  BoxIcon,
  ChevronRight,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  version: string;
  onClick?: () => void;
}

function ModuleCard({
  title,
  description,
  icon: Icon,
  version,
  onClick,
}: ModuleCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-black/40 hover:bg-black/60 border-b border-white/5 last:border-b-0 p-6 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-white/5 group-hover:bg-white/10 rounded-lg flex items-center justify-center transition-all duration-200">
            <Icon className="w-6 h-6 text-white/60 group-hover:text-white/90 transition-colors" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-base font-medium text-white/90 group-hover:text-white transition-colors">
              {title}
            </h4>
            <span className="text-[10px] text-white/30 font-mono">
              {version}
            </span>
          </div>
          <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors line-clamp-1">
            {description}
          </p>
        </div>

        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 text-white/30 group-hover:text-white/70 transition-colors">
            <span className="text-xs font-medium">Abrir</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

type ModuleDef = {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  version: string;
  path: string;
  group: "principal" | "alternativo";
};

export default function ProcessesSection() {
  const router = useRouter();
  const { userData, companyData } = useCompany();

  // Módulos definidos con ID
  const modules: ModuleDef[] = [
    {
      id: 1,
      title: "Recibo",
      description:
        "Registra la entrada de mercancía, valida contra órdenes de compra y asegura cantidades correctas, ORDEN DE COMPRA",
      icon: Inbox,
      version: "v2.1.0",
      path: "/recibo",
      group: "principal",
    },

    {
      id: 2,
      title: "Acomodo",
      description:
        "Ubica y organiza la mercancía recibida en su posición correcta dentro del almacén.",
      icon: LucideWarehouse,
      version: "v2.1.0",
      path: "/acomodo",
      group: "principal",
    },

    {
      id: 4,
      title: "Packing",
      description:
        "Empaca y consolida los productos seleccionados para el envío o entrega.",
      icon: BoxIcon,
      version: "v2.1.0",
      path: "/ordenes-packing",
      group: "principal",
    },
  ];

  // Permisos desde el login (normalizados)
  const allowed = new Set<number>(userData?.modulosKrknArr ?? []);

  // Regla especial: para el cliente GOUMAM mostramos únicamente el módulo snMicro (id 5).
  // Para cualquier otro cliente mostramos todos los módulos.
  const isGoumam = (() => {
    try {
      const code = (companyData?.codigo || "").toString().toLowerCase();
      const name = (companyData?.nombre || "").toString().toLowerCase();
      return code.includes("goumam") || name.includes("goumam");
    } catch {
      return false;
    }
  })();

  // For GOUMAM show modules with id 2 (ACOMODO) and 5 (SNMICRO)
  const effectiveModules = isGoumam
    ? modules.filter((m) => [2, 5].includes(m.id))
    : modules;

  const principales = effectiveModules.filter((m) => m.group === "principal");
  const alternativos = effectiveModules.filter(
    (m) => m.group === "alternativo"
  );

  const go = (path: string) => () => router.push(path);

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-1 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-semibold text-white">
            Procesos y Módulos
          </h2>
          <p className="text-sm text-white/40">
            Gestiona tus operaciones de almacén
          </p>
        </div>

        <div className="space-y-8">
          {principales.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3 px-6">
                Módulos Principales
              </h3>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                {principales.map((m) => (
                  <ModuleCard
                    key={m.id}
                    title={m.title}
                    description={m.description}
                    icon={m.icon}
                    version={m.version}
                    onClick={go(m.path)}
                  />
                ))}
              </div>
            </div>
          )}

          {alternativos.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3 px-6">
                Módulos Alternativos
              </h3>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                {alternativos.map((m) => (
                  <ModuleCard
                    key={m.id}
                    title={m.title}
                    description={m.description}
                    icon={m.icon}
                    version={m.version}
                    onClick={go(m.path)}
                  />
                ))}
              </div>
            </div>
          )}

          {effectiveModules.length === 0 && (
            <div className="text-center text-white/40 text-sm">
              No tienes módulos habilitados. Contacta al administrador.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
