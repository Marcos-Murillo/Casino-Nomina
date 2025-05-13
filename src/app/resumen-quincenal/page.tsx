"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, setDate, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Search, Trash2, FileDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog"
import { Alert, AlertDescription } from "../components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Label } from "../components/ui/label"
import { useToast } from "../hooks/use-toast"
import { empleados } from "../data/empleados"
import {
  eliminarResumenEmpleado,
  obtenerResumenPorId,
  obtenerResumenesEmpleadosDirecto,
  actualizarResumenEmpleado,
} from "../firebase/services"
import type { ResumenEmpleado } from "../data/empleados"


export default function ResumenQuincenal() {
  const { toast } = useToast()
  const [resumenes, setResumenes] = useState<(ResumenEmpleado & { fechaGuardado: Date })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filtroEmpleado, setFiltroEmpleado] = useState("todos")
  const [filtroFecha, setFiltroFecha] = useState("")
  const [resumenSeleccionado, setResumenSeleccionado] = useState<string | null>(null)
  const [resumenDetalle, setResumenDetalle] = useState<ResumenEmpleado | null>(null)
  const [resumenEditado, setResumenEditado] = useState<ResumenEmpleado | null>(null)
  const [isLoadingDetalle, setIsLoadingDetalle] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mesActual, setMesActual] = useState(new Date())
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<"primera" | "segunda">("primera")

  // Calcular fechas de inicio y fin según el período seleccionado
  const inicioMes = startOfMonth(mesActual)
  const finMes = endOfMonth(mesActual)

  // Primera quincena: del 1 al 15
  const inicioPrimeraQuincena = inicioMes
  const finPrimeraQuincena = setDate(new Date(mesActual), 15)

  // Segunda quincena: del 16 al último día del mes
  const inicioSegundaQuincena = setDate(new Date(mesActual), 16)
  const finSegundaQuincena = finMes

  // Fechas actuales según el período seleccionado
  const fechaInicio = periodoSeleccionado === "primera" ? inicioPrimeraQuincena : inicioSegundaQuincena
  const fechaFin = periodoSeleccionado === "primera" ? finPrimeraQuincena : finSegundaQuincena

  // Cargar resúmenes al iniciar o cambiar el período
  useEffect(() => {
    const cargarResumenes = async () => {
      setIsLoading(true)
      try {
        console.log("Iniciando carga de resúmenes...")

        // Obtener todos los documentos de la colección
        const data = await obtenerResumenesEmpleadosDirecto()
        console.log("Datos obtenidos:", data)

        if (data && data.length > 0) {
          // Filtrar los resúmenes por el mes y quincena seleccionados
          const resumenesFiltrados = data.filter((resumen) => {
            // Convertir las fechas del período a objetos Date
            const periodoInicio = new Date(resumen.periodo.inicio)
            const periodoFin = new Date(resumen.periodo.fin)

            // Verificar si el mes y año coinciden con el seleccionado
            const mesCoincide =
              periodoInicio.getMonth() === mesActual.getMonth() &&
              periodoInicio.getFullYear() === mesActual.getFullYear()

            if (!mesCoincide) return false

            // Determinar si el resumen pertenece a la primera o segunda quincena
            // Un resumen pertenece a la primera quincena si su fecha de inicio está entre el 1 y el 15
            const esPrimeraQuincena = periodoInicio.getDate() <= 15

            // Verificar si coincide con el período seleccionado
            return (
              (periodoSeleccionado === "primera" && esPrimeraQuincena) ||
              (periodoSeleccionado === "segunda" && !esPrimeraQuincena)
            )
          })

          setResumenes(resumenesFiltrados)
          console.log("Resúmenes filtrados por período:", resumenesFiltrados.length)
        } else {
          console.log("No se encontraron resúmenes en la base de datos")
          setResumenes([])
        }
      } catch (error) {
        console.error("Error al cargar resúmenes:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los resúmenes. Revisa la consola para más detalles.",
          variant: "destructive",
        })
        // Establecer un array vacío para evitar que se quede cargando indefinidamente
        setResumenes([])
      } finally {
        setIsLoading(false)
      }
    }

    cargarResumenes()
  }, [toast, mesActual, periodoSeleccionado])

  // Filtrar resúmenes
  const resumenesFiltrados = resumenes.filter((resumen) => {
    // Filtrar por empleado
    if (filtroEmpleado !== "todos" && resumen.empleadoId !== filtroEmpleado) {
      return false
    }

    // Filtrar por fecha
    if (filtroFecha) {
      const fechaResumen = format(resumen.fechaGuardado, "dd/MM/yyyy")
      if (!fechaResumen.includes(filtroFecha)) {
        return false
      }
    }

    return true
  })

  // Eliminar resumen
  const handleEliminarResumen = async (id: string) => {
    if (!confirm("¿Está seguro que desea eliminar este resumen?")) return

    try {
      await eliminarResumenEmpleado(id)
      setResumenes(resumenes.filter((r) => r.id !== id))
      toast({
        title: "Resumen eliminado",
        description: "El resumen ha sido eliminado correctamente",
      })
    } catch (error) {
      console.error("Error al eliminar resumen:", error)
      toast({
        title: "Error",
        description: "No se pudo eliminar el resumen",
        variant: "destructive",
      })
    }
  }

  // Ver detalle de resumen
  const handleVerDetalle = async (id: string) => {
    setIsLoadingDetalle(true)
    setResumenSeleccionado(id)

    try {
      const resumen = await obtenerResumenPorId(id)
      setResumenDetalle(resumen)
      setResumenEditado(JSON.parse(JSON.stringify(resumen))) // Copia profunda para edición
    } catch (error) {
      console.error("Error al obtener detalle del resumen:", error)
      toast({
        title: "Error",
        description: "No se pudo cargar el detalle del resumen",
        variant: "destructive",
      })
    } finally {
      setIsLoadingDetalle(false)
    }
  }

  // Manejar cambios en los campos de deducciones
  const handleDeduccionChange = (campo: string, valor: string) => {
    if (!resumenEditado) return

    const valorNumerico = valor === "" ? 0 : Number(valor.replace(/,/g, ""))

    setResumenEditado({
      ...resumenEditado,
      deducciones: {
        ...resumenEditado.deducciones,
        [campo]: valorNumerico,
      },
    })
  }

  // Manejar cambios en otros campos
  const handleCampoChange = (campo: string, valor: string) => {
    if (!resumenEditado) return

    const valorNumerico = valor === "" ? 0 : Number(valor.replace(/,/g, ""))

    setResumenEditado({
      ...resumenEditado,
      [campo]: valorNumerico,
    })
  }

  // Guardar cambios en el resumen
  const guardarCambiosResumen = async () => {
    if (!resumenEditado || !resumenEditado.id) return

    setIsSaving(true)
    try {
      // Calcular el nuevo total basado en los valores actualizados
      const empleado = empleados.find((e) => e.nombre === resumenEditado.empleadoId)

      if (!empleado) {
        throw new Error("No se encontró información del empleado")
      }

      // Calcular valor de horas a la quincena
      const valorHorasQuincena =
        (resumenEditado.horasNormales + resumenEditado.horasNormalNocturnas) * empleado.valorHora

      // Calcular valor de días de incapacidad
      const valorDiasIncapacidad = resumenEditado.diasIncapacidad * empleado.valorDia

      // Calcular total devengado
      const totalDevengado =
        valorHorasQuincena +
        resumenEditado.horasExtraDiurnas * empleado.horaExtraDiurna +
        resumenEditado.horasExtraNocturnas * empleado.horaExtraNocturna +
        resumenEditado.horasFeriadoDiurnas * empleado.horaFeriadaDiurna +
        resumenEditado.horasExtraFeriadoDiurnas * empleado.horaExtraFeriadaDiurna +
        resumenEditado.horasFeriadoNocturnas * empleado.horaNocturnaDiurna +
        resumenEditado.horasExtraFeriadoNocturnas * empleado.horaExtraFeriadaNocturna +
        resumenEditado.auxilioTransporte +
        valorDiasIncapacidad

      // Calcular total deducciones
      const totalDeducciones =
        resumenEditado.deducciones.seguridadSocial +
        resumenEditado.deducciones.polizaSura +
        resumenEditado.deducciones.adelantoNomina +
        resumenEditado.deducciones.otrosDescuentos

      // Calcular total a pagar
      const totalAPagar = totalDevengado + resumenEditado.beneficioProductividad - totalDeducciones

      // Actualizar el total en el resumen editado
      const resumenActualizado = {
        ...resumenEditado,
        totalValor: totalAPagar,
      }

      // Guardar en Firestore
      await actualizarResumenEmpleado(resumenActualizado)

      // Actualizar la lista de resúmenes
      setResumenes(resumenes.map((r) => (r.id === resumenActualizado.id ? { ...r, ...resumenActualizado } : r)))

      // Actualizar el detalle mostrado
      setResumenDetalle(resumenActualizado)

      toast({
        title: "Cambios guardados",
        description: "Los cambios en el resumen han sido guardados correctamente",
      })
    } catch (error) {
      console.error("Error al guardar cambios:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Exportar resumen a PDF
  const exportarResumenPDF = (resumen: ResumenEmpleado & { fechaGuardado: Date }) => {
    // Aquí implementarías la lógica para exportar a PDF
    // Por ahora, solo mostraremos un mensaje
    toast({
      title: "Exportando a PDF",
      description: `Exportando resumen de ${resumen.empleadoId}`,
    })

    // Preparar los datos para imprimir
    const empleado = empleados.find((e) => e.nombre === resumen.empleadoId)

    // Crear una ventana de impresión
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({
        title: "Error",
        description: "No se pudo abrir la ventana de impresión",
        variant: "destructive",
      })
      return
    }

    // Formatear fechas
    const fechaInicio = format(resumen.periodo.inicio, "dd/MM/yyyy", { locale: es })
    const fechaFin = format(resumen.periodo.fin, "dd/MM/yyyy", { locale: es })

 // Contenido HTML para imprimir
 printWindow.document.write(`
  <html>
    <head>
      <title>Resumen Quincenal - ${resumen.empleadoId}</title>
      <style>
        body { font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 10px }
            h1 { 
              text-align: center; 
              font-size: 16px; 
              margin-bottom: 10px; 
            }
            h2 { 
              font-size: 12px; 
              margin-top: 10px; 
              margin-bottom: 5px; 
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 10px; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 10px; 
              font-size: 9px;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 4px; 
              text-align: left; 
            }
            th { 
              background-color: #f2f2f2; 
              font-size: 9px;
            }
            .total { 
              font-weight: bold; 
            }
            .signature-area {
              margin-top: 20px;
              display: flex;
              justify-content: space-between;
            }
            .signature {
              border-top: 1px solid #000;
              width: 200px;
              text-align: center;
              padding-top: 5px;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 10px; 
              }
              table { page-break-inside: avoid; }
            }
        </style>
    <body>
      <h1>Desprendible de nomina</h1>
      
      <div class="header">
        <div>
          <p><strong>Empleado:</strong> ${resumen.empleadoId}</p>
          <p><strong>Período:</strong> ${fechaInicio} - ${fechaFin}</p>
        </div>
        <div>
          <p><strong>Fecha de generación:</strong> ${format(resumen.fechaGuardado, "dd/MM/yyyy HH:mm", { locale: es })}</p>
        </div>
      </div>
      
      <h2>Horas Trabajadas</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo de Hora</th>
            <th>Cantidad</th>
            <th>Valor Unitario</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr class="total">
            <td>Horas a la Quincena</td>
            <td>${(resumen.horasNormales + resumen.horasNormalNocturnas + resumen.horasFeriadoDiurnas + resumen.horasFeriadoDiurnas).toFixed(2)}</td>
            <td>$${empleado?.valorHora.toLocaleString() || 0}</td>
            <td>$${((resumen.horasNormales + resumen.horasNormalNocturnas + resumen.horasFeriadoDiurnas + resumen.horasFeriadoDiurnas) * (empleado?.valorHora || 0)).toLocaleString()}</td>
          </tr>
          <tr>
                <td>Horas Extra Diurnas (HED)</td>
                <td>${resumen.horasExtraDiurnas.toFixed(2)}</td>
                <td>$${empleado?.horaExtraDiurna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasExtraDiurnas * (empleado?.horaExtraDiurna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Normal Nocturnas (HNN)</td>
                <td>${resumen.horasNormalNocturnas.toFixed(2)}</td>
                <td>$${empleado?.horaNormalNocturna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasNormalNocturnas * (empleado?.horaNormalNocturna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Extra Nocturnas (HEN)</td>
                <td>${resumen.horasExtraNocturnas.toFixed(2)}</td>
                <td>$${empleado?.horaExtraNocturna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasExtraNocturnas * (empleado?.horaExtraNocturna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Feriado Diurnas (HFD)</td>
                <td>${resumen.horasFeriadoDiurnas.toFixed(2)}</td>
                <td>${empleado?.horaFeriadaDiurna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasFeriadoDiurnas * (empleado?.horaFeriadaDiurna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Extra Feriado Diurnas (HEFD)</td>
                <td>${resumen.horasExtraFeriadoDiurnas.toFixed(2)}</td>
                <td>$${empleado?.horaExtraFeriadaDiurna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasExtraFeriadoDiurnas * (empleado?.horaExtraFeriadaDiurna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Feriado Nocturnas (HFN)</td>
                <td>${resumen.horasFeriadoNocturnas.toFixed(2)}</td>
                <td>$${empleado?.horaNocturnaDiurna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasFeriadoNocturnas * (empleado?.horaNocturnaDiurna || 0)).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Horas Extra Feriado Nocturnas (HEFN)</td>
                <td>${resumen.horasExtraFeriadoNocturnas.toFixed(2)}</td>
                <td>$${empleado?.horaExtraFeriadaNocturna.toLocaleString() || 0}</td>
                <td>$${(resumen.horasExtraFeriadoNocturnas * (empleado?.horaExtraFeriadaNocturna || 0)).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
      
      <h2>Información Adicional</h2>
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Auxilio de Transporte</td>
            <td>$${resumen.auxilioTransporte.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Auxilio de Alimentación</td>
            <td>$${resumen.auxilioAlimentacion.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Días de Incapacidad</td>
            <td>${resumen.diasIncapacidad.toFixed(1)} días ($${(resumen.diasIncapacidad * (empleado?.valorDia || 0)).toLocaleString()})</td>
          </tr>
          <tr>
            <td>Beneficio de Productividad</td>
            <td>$${resumen.beneficioProductividad.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <h2>Deducciones</h2>
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Seguridad Social</td>
            <td>$${resumen.deducciones.seguridadSocial.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Adelanto Nómina</td>
            <td>$${resumen.deducciones.adelantoNomina.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Otros Descuentos</td>
            <td>$${resumen.deducciones.otrosDescuentos.toLocaleString()}</td>
          </tr>
          <tr class="total">
            <td>Total Deducciones</td>
            <td>$${(
              resumen.deducciones.seguridadSocial +
                resumen.deducciones.polizaSura +
                resumen.deducciones.adelantoNomina +
                resumen.deducciones.otrosDescuentos
            ).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="text-align: right; margin-top: 30px;">
        <p><strong>Total a Pagar:</strong> $${resumen.totalValor?.toLocaleString() || 0}</p>
      </div>


      <div class="signature-area" style="margin-top: 70px;" >
            <div class="signature">
              Firma del Empleado
            </div>
            <div class="signature">
              Firma del Empleador
            </div>
          </div>
        </body>
      </html>
    </body>
  </html>
  
`)

// Imprimir y cerrar
printWindow.document.close()
printWindow.print()
}


  // Calcular totales
  const calcularTotales = () => {
    let totalHoras = 0
    let totalValor = 0

    resumenesFiltrados.forEach((resumen) => {
      totalHoras +=
        resumen.horasNormales +
        resumen.horasExtraDiurnas +
        resumen.horasNormalNocturnas +
        resumen.horasExtraNocturnas +
        resumen.horasFeriadoDiurnas +
        resumen.horasExtraFeriadoDiurnas +
        resumen.horasFeriadoNocturnas +
        resumen.horasExtraFeriadoNocturnas

      // Calcular valor total
      totalValor += resumen.totalValor || 0
    })

    return { totalHoras, totalValor }
  }

  const totales = calcularTotales()

  return (
    <main className="min-h-screen bg-background p-6">
      <Card className="mx-auto max-w-6xl">
        <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 bg-card">
          <CardTitle className="text-2xl font-bold text-card-foreground">Resumen Quincenal</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar a PDF
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Selector de mes y quincena */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setMesActual(subMonths(mesActual, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium text-foreground">
                {format(mesActual, "MMMM yyyy", { locale: es })}
              </span>
              <Button variant="outline" onClick={() => setMesActual(addMonths(mesActual, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Tabs
              value={periodoSeleccionado}
              onValueChange={(value) => setPeriodoSeleccionado(value as "primera" | "segunda")}
            >
              <TabsList>
                <TabsTrigger value="primera">Primera Quincena (1-15)</TabsTrigger>
                <TabsTrigger value="segunda">Segunda Quincena (16-{format(finMes, "d")})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por fecha (dd/mm/yyyy)"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-64"
              />
            </div>

            <Select value={filtroEmpleado} onValueChange={setFiltroEmpleado}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filtrar por empleado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los empleados</SelectItem>
                {empleados.map((empleado) => (
                  <SelectItem key={empleado.nombre} value={empleado.nombre}>
                    {empleado.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabla de resúmenes */}
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-foreground">Cargando resúmenes...</span>
            </div>
          ) : (
            <>
              {resumenes.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No se encontraron resúmenes.
                    <div className="mt-2">
                      <details>
                        <summary className="cursor-pointer text-sm text-primary">Información de depuración</summary>
                        <div className="mt-2 rounded-md bg-muted p-2 text-xs">
                          <p>Período seleccionado: {periodoSeleccionado}</p>
                          <p>Fecha inicio: {fechaInicio.toISOString()}</p>
                          <p>Fecha fin: {fechaFin.toISOString()}</p>
                          <p>Filtro empleado: {filtroEmpleado}</p>
                          <p>Filtro fecha: {filtroFecha}</p>
                        </div>
                      </details>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : resumenesFiltrados.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No se encontraron resúmenes con los filtros seleccionados.
                    <div className="mt-2">
                      <p className="text-sm">
                        Hay {resumenes.length} resúmenes en total, pero ninguno coincide con los filtros actuales.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-4">
                    {resumenesFiltrados.map((resumen) => {
                      const empleado = empleados.find((e) => e.nombre === resumen.empleadoId)

                      return (
                        <div
                          key={resumen.id}
                          className="flex items-center justify-between rounded-lg border border-border p-4 shadow-sm bg-card"
                        >
                          <div className="flex-1">
                            <h3 className="font-medium text-card-foreground">
                              {empleado?.nombre || resumen.empleadoId}
                            </h3>
                            <div className="mt-1 flex flex-col text-sm text-muted-foreground sm:flex-row sm:gap-4">
                              <span>
                                Período: {format(resumen.periodo.inicio, "dd/MM/yyyy", { locale: es })} -
                                {format(resumen.periodo.fin, "dd/MM/yyyy", { locale: es })}
                              </span>
                              <span>Guardado: {format(resumen.fechaGuardado, "dd/MM/yyyy HH:mm", { locale: es })}</span>
                            </div>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-lg font-bold text-card-foreground">
                              ${resumen.totalValor?.toLocaleString() || "0"}
                            </p>
                          </div>
                          <div className="ml-6 flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                                  onClick={() => handleVerDetalle(resumen.id || "")}
                                >
                                  Ver y Editar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Detalle del Resumen</DialogTitle>
                                  <DialogDescription>Información detallada del resumen quincenal</DialogDescription>
                                </DialogHeader>

                                {isLoadingDetalle ? (
                                  <div className="flex h-40 items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="ml-2">Cargando detalle...</span>
                                  </div>
                                ) : resumenEditado ? (
                                  <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <h3 className="font-semibold">Empleado:</h3>
                                        <p>{resumenEditado.empleadoId}</p>
                                      </div>
                                      <div>
                                        <h3 className="font-semibold">Período:</h3>
                                        <p>
                                          {format(resumenEditado.periodo.inicio, "dd/MM/yyyy", { locale: es })} -
                                          {format(resumenEditado.periodo.fin, "dd/MM/yyyy", { locale: es })}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="rounded-md border border-border">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="border-b border-border bg-muted">
                                            <th className="p-3 text-left">Tipo de Hora</th>
                                            <th className="p-3 text-right">Cantidad</th>
                                            <th className="p-3 text-right">Valor Unitario</th>
                                            <th className="p-3 text-right">Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr className="border-b border-border bg-muted">
                                            <td className="p-3 font-medium">Horas a la Quincena</td>
                                            <td className="p-3 text-right font-medium">
                                              <Input
                                                type="text"
                                                value={(
                                                  resumenEditado.horasNormales + resumenEditado.horasNormalNocturnas
                                                ).toFixed(2)}
                                                disabled
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                              ${empleado?.valorHora.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right font-medium">
                                              $
                                              {(
                                                (resumenEditado.horasNormales + resumenEditado.horasNormalNocturnas) *
                                                (empleado?.valorHora || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Extra Diurnas (HED)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasExtraDiurnas.toFixed(2)}
                                                onChange={(e) => handleCampoChange("horasExtraDiurnas", e.target.value)}
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaExtraDiurna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasExtraDiurnas * (empleado?.horaExtraDiurna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Normal Nocturnas (HNN)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasNormalNocturnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasNormalNocturnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaNormalNocturna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasNormalNocturnas *
                                                (empleado?.horaNormalNocturna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Extra Nocturnas (HEN)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasExtraNocturnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasExtraNocturnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaExtraNocturna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasExtraNocturnas * (empleado?.horaExtraNocturna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Feriado Diurnas (HFD)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasFeriadoDiurnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasFeriadoDiurnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaFeriadaDiurna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasFeriadoDiurnas * (empleado?.horaFeriadaDiurna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Extra Feriado Diurnas (HEFD)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasExtraFeriadoDiurnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasExtraFeriadoDiurnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaExtraFeriadaDiurna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasExtraFeriadoDiurnas *
                                                (empleado?.horaExtraFeriadaDiurna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Feriado Nocturnas (HFN)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasFeriadoNocturnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasFeriadoNocturnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaNocturnaDiurna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasFeriadoNocturnas *
                                                (empleado?.horaNocturnaDiurna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                          <tr className="border-b border-border">
                                            <td className="p-3">Horas Extra Feriado Nocturnas (HEFN)</td>
                                            <td className="p-3 text-right">
                                              <Input
                                                type="text"
                                                value={resumenEditado.horasExtraFeriadoNocturnas.toFixed(2)}
                                                onChange={(e) =>
                                                  handleCampoChange("horasExtraFeriadoNocturnas", e.target.value)
                                                }
                                                className="w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-3 text-right">
                                              ${empleado?.horaExtraFeriadaNocturna.toLocaleString() || 0}
                                            </td>
                                            <td className="p-3 text-right">
                                              $
                                              {(
                                                resumenEditado.horasExtraFeriadoNocturnas *
                                                (empleado?.horaExtraFeriadaNocturna || 0)
                                              ).toLocaleString()}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label htmlFor="auxilioTransporte" className="font-semibold">
                                          Auxilio Transporte:
                                        </Label>
                                        <Input
                                          id="auxilioTransporte"
                                          type="text"
                                          value={resumenEditado.auxilioTransporte.toLocaleString()}
                                          onChange={(e) => handleCampoChange("auxilioTransporte", e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="auxilioAlimentacion" className="font-semibold">
                                          Auxilio Alimentación:
                                        </Label>
                                        <Input
                                          id="auxilioAlimentacion"
                                          type="text"
                                          value={resumenEditado.auxilioAlimentacion.toLocaleString()}
                                          onChange={(e) => handleCampoChange("auxilioAlimentacion", e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="beneficioProductividad" className="font-semibold">
                                          Beneficio Productividad:
                                        </Label>
                                        <Input
                                          id="beneficioProductividad"
                                          type="text"
                                          value={resumenEditado.beneficioProductividad.toLocaleString()}
                                          onChange={(e) => handleCampoChange("beneficioProductividad", e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="diasIncapacidad" className="font-semibold">
                                          Días de Incapacidad:
                                        </Label>
                                        <Input
                                          id="diasIncapacidad"
                                          type="text"
                                          value={resumenEditado.diasIncapacidad.toLocaleString()}
                                          onChange={(e) => handleCampoChange("diasIncapacidad", e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <h3 className="font-semibold mb-2">Deducciones:</h3>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <Label htmlFor="seguridadSocial">Seguridad Social:</Label>
                                          <Input
                                            id="seguridadSocial"
                                            type="text"
                                            value={resumenEditado.deducciones.seguridadSocial.toLocaleString()}
                                            onChange={(e) => handleDeduccionChange("seguridadSocial", e.target.value)}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="polizaSura">Póliza Sura:</Label>
                                          <Input
                                            id="polizaSura"
                                            type="text"
                                            value={resumenEditado.deducciones.polizaSura.toLocaleString()}
                                            onChange={(e) => handleDeduccionChange("polizaSura", e.target.value)}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="adelantoNomina">Adelanto Nómina:</Label>
                                          <Input
                                            id="adelantoNomina"
                                            type="text"
                                            value={resumenEditado.deducciones.adelantoNomina.toLocaleString()}
                                            onChange={(e) => handleDeduccionChange("adelantoNomina", e.target.value)}
                                            className="mt-1"
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor="otrosDescuentos">Otros Descuentos:</Label>
                                          <Input
                                            id="otrosDescuentos"
                                            type="text"
                                            value={resumenEditado.deducciones.otrosDescuentos.toLocaleString()}
                                            onChange={(e) => handleDeduccionChange("otrosDescuentos", e.target.value)}
                                            className="mt-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p>No se pudo cargar el detalle del resumen</p>
                                )}

                                <DialogFooter className="mt-4">
                                  <Button type="submit" onClick={guardarCambiosResumen} disabled={isSaving}>
                                    {isSaving ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                      </>
                                    ) : (
                                      "Guardar Cambios"
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Botón para exportar a PDF */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                              onClick={() => exportarResumenPDF(resumen)}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>

                            {/* Botón para eliminar */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                              onClick={() => handleEliminarResumen(resumen.id || "")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-6 rounded-lg border border-border bg-muted p-4">
                    <div className="flex justify-between">
                      <span className="font-medium text-foreground">Total:</span>
                      <span className="font-bold text-foreground">${totales.totalValor.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
