import "./globals.css" // Asegúrate de que la ruta sea correcta
import { Inter } from "next/font/google"
import type React from "react"
import { Toaster } from "../app/components/ui/toaster"
import Sidebar from "../app/components/sidebar"
import { ThemeProvider } from "../app/components/theme-provider"

// Configuración de la fuente Inter con display swap para mejor rendimiento
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
})

export const metadata = {
  title: "Sistema de Nómina",
  description: "Sistema de registro de horas y cálculo de salarios",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <div className="flex h-full min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1">{children}</div>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
