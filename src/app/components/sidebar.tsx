"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Clock, BarChart2, User, FileText, Calendar, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "../components/ui/button"
import { ThemeToggle } from "../components/theme-toggle"

const menuItems = [
  {
    name: "Inicio",
    href: "/",
    icon: Home,
  },
  {
    name: "Registro de Horas",
    href: "/registro-horas",
    icon: Clock,
  },
  {
    name: "Calendario de Horarios",
    href: "/calendario-horarios",
    icon: Calendar,
  },
  {
    name: "Resumen por Empleado",
    href: "/resumen-empleados",
    icon: User,
  },
  {
    name: "Resumen Quincenal",
    href: "/resumen-quincenal",
    icon: FileText,
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Botón para mostrar/ocultar sidebar en móvil */}
      <Button variant="outline" size="icon" className="fixed left-4 top-4 z-50 md:hidden" onClick={toggleSidebar}>
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h2 className="text-lg font-semibold text-card-foreground">Sistema de Nómina</h2>
          <ThemeToggle />
        </div>
        <nav className="flex-1 overflow-auto py-4">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">© 2025 Sistema de Nómina</p>
        </div>
      </div>

      {/* Overlay para cerrar el sidebar en móvil */}
      {isOpen && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
