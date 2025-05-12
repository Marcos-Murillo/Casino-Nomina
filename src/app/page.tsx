import { Button } from "../app/components/ui/button"
import Link from "next/link"
import { CardFooter } from "../app/components/ui/card"
import { CardContent } from "../app/components/ui/card"
import { CardTitle } from "../app/components/ui/card"
import { CardHeader } from "../app/components/ui/card"
import { Card } from "../app/components/ui/card"
import { ThemeToggle } from "../app/components/theme-toggle"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <h1 className="text-4xl font-bold mb-8">Sistema de Nómina</h1>
      <p className="text-xl mb-12">Bienvenido al sistema de gestión de nómina y horarios</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Registro de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Registra las horas trabajadas por los empleados</p>
          </CardContent>
          <CardFooter>
            <Link href="/registro-horas">
              <Button>Ir a Registro</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Calendario de Horarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Visualiza y gestiona los horarios de trabajo</p>
          </CardContent>
          <CardFooter>
            <Link href="/calendario-horarios">
              <Button>Ver Calendario</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Resumen Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Consulta el resumen semanal de horas trabajadas</p>
          </CardContent>
          <CardFooter>
            <Link href="/resumen-semanal">
              <Button>Ver Resumen</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Resumen Quincenal</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Consulta el resumen quincenal de horas y salarios</p>
          </CardContent>
          <CardFooter>
            <Link href="/resumen-quincenal">
              <Button>Ver Resumen</Button>
            </Link>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Resumen por Empleado</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Consulta el resumen detallado por empleado</p>
          </CardContent>
          <CardFooter>
            <Link href="/resumen-empleados">
              <Button>Ver Resumen</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
