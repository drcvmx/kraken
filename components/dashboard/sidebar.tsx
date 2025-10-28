"use client";

import { useState, useEffect, useRef } from "react";
import {
  UserCircle,
  LogOut,
  ChevronDown,
  MoreVertical,
  Globe,
  LayoutDashboard,
  FileSearch,
  FolderArchive,
  Network,
  Box,
  LineChart,
  Package,
  Briefcase,
  CalendarClock,
  ClipboardList,
  BarChart3,
  Users2,
  Settings,
  Search,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout: () => void;
}

interface MenuItem {
  name: string;
  icon: any;
  children?: MenuItem[];
  requiresModule?: number;
}

export default function Sidebar({
  activeSection,
  onSectionChange,
  onLogout,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [showCollapsedMenu, setShowCollapsedMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { userData } = useCompany();

  const hasModule = (moduleId: number): boolean => {
    if (!userData?.MODULOS_KRKN) return false;

    let modules: number[] = [];

    if (Array.isArray(userData.MODULOS_KRKN)) {
      modules = userData.MODULOS_KRKN;
    } else if (typeof userData.MODULOS_KRKN === "string") {
      try {
        modules = JSON.parse(userData.MODULOS_KRKN);
      } catch {
        modules = userData.MODULOS_KRKN.split(",")
          .map((m) => Number.parseInt(m.trim()))
          .filter((n) => !isNaN(n));
      }
    }

    return modules.includes(moduleId);
  };

  const allMenuItems: MenuItem[] = [
    { name: "ADUANA", icon: Globe },
    { name: "APLICACIONES", icon: LayoutDashboard },
    { name: "AUDITORÍA", icon: FileSearch },
    { name: "CATÁLOGOS", icon: FolderArchive },
    { name: "INTEGRACIONES", icon: Network },
    { name: "INVENTARIO", icon: Box },
    { name: "KPI's", icon: LineChart },
    { name: "LAYOUT", icon: Package },
    // { name: "PLANEACIÓN", icon: CalendarClock },
    { name: "PROCESOS", icon: ClipboardList },
    { name: "TABLEROS", icon: BarChart3 },
  ];

  const menuItems = allMenuItems.filter((item) => {
    if (item.requiresModule) {
      return hasModule(item.requiresModule);
    }
    return true;
  });

  const filteredMenuItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionName)
        ? prev.filter((s) => s !== sectionName)
        : [...prev, sectionName]
    );
  };

  const handleMenuClick = (itemName: string, hasChildren: boolean) => {
    if (hasChildren) {
      toggleSection(itemName);
    } else {
      onSectionChange(itemName);
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setSearchQuery("");
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Solo se expande cuando el cursor está sobre el sidebar
  const isExpanded = isHovered;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative transition-all duration-300 ease-out flex flex-col h-screen bg-[#0a0a0a] border-r border-white/5 ${
        isExpanded ? "w-64" : "w-14 sm:w-16"
      }`}
    >
      {/* Logo / Header */}
      <div className="p-2 sm:p-4 border-b border-white/5 flex items-center justify-between min-h-[60px] sm:min-h-[72px]">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <div className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.5 8.5L22 9.5L17 14.5L18.5 21L12 17.5L5.5 21L7 14.5L2 9.5L8.5 8.5L12 2Z" />
              </svg>
            </div>
          </div>
          {isExpanded && (
            <span className="text-white font-medium text-sm whitespace-nowrap">
              KRKN Dashboard
            </span>
          )}
        </div>
      </div>

      {/* Search Bar (only when expanded) */}
      {isExpanded && (
        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
            />
          </div>
        </div>
      )}

      {/* Menu Items */}
      <nav className="flex-1 p-1 sm:p-2 space-y-0.5 sm:space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isSectionExpanded = expandedSections.includes(item.name);
          const isActive = activeSection === item.name;

          return (
            <div key={item.name}>
              <button
                onClick={() => handleMenuClick(item.name, !!hasChildren)}
                className={`w-full flex items-center justify-between px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-purple-500/10 text-purple-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
                title={!isExpanded ? item.name : undefined}
              >
                <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  {isExpanded && (
                    <span className="text-sm font-normal whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </div>
                {isExpanded && hasChildren && (
                  <ChevronDown
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                      isSectionExpanded ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {/* Children (only show when expanded and section is expanded) */}
              {isExpanded && hasChildren && isSectionExpanded && (
                <div className="ml-3 mt-1 space-y-1 border-l border-white/5 pl-3">
                  {item.children?.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = activeSection === child.name;

                    return (
                      <button
                        key={child.name}
                        onClick={() => onSectionChange(child.name)}
                        className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isChildActive
                            ? "bg-purple-500/10 text-purple-400"
                            : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <ChildIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-normal whitespace-nowrap">
                          {child.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 sm:p-3 border-t border-white/5">
        {isExpanded ? (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onSectionChange("PERFIL")}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 flex items-center justify-center group relative"
              title="Cuenta General"
            >
              <UserCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={() => onSectionChange("CONFIGURACION")}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 flex items-center justify-center group relative"
              title="Configuración"
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={onLogout}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-red-950/20 text-gray-400 hover:text-red-400 transition-all duration-200 flex items-center justify-center group relative"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowCollapsedMenu(!showCollapsedMenu)}
              className="w-full p-2 sm:p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 flex items-center justify-center"
              title="Opciones"
            >
              <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {showCollapsedMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowCollapsedMenu(false)}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      onSectionChange("PERFIL");
                      setShowCollapsedMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center gap-3"
                  >
                    <UserCircle className="w-4 h-4" />
                    <span>Cuenta General</span>
                  </button>

                  <button
                    onClick={() => {
                      onSectionChange("CONFIGURACION");
                      setShowCollapsedMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center gap-3"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Configuración</span>
                  </button>

                  <div className="h-px bg-white/5 my-1" />

                  <button
                    onClick={() => {
                      onLogout();
                      setShowCollapsedMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-400 hover:text-red-400 hover:bg-red-950/20 transition-all duration-200 flex items-center gap-3"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
