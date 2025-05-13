"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Progress } from "../components/ui/progress"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Edit, DollarSign, Loader2, Save, ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, setDate, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { empleados } from "../data/empleados"
import {
  obtenerRegistrosPorPeriodo,
  guardarConfiguracion,
  obtenerConfiguracion,
  guardarResumenEmpleado,
} from "../firebase/services"
import { useToast } from "../hooks/use-toast"

// Definir tipos para los datos de ejemplo
interface ResumenEmpleadoUI {
  empleado: string
  cedula: string
  cargo: string
  salarioBase: number
  periodo: {
    inicio: Date
    fin: Date
  }
  horas: {
    normales: number
    extraDiurnas: number
    normalNocturnas: number
    extraNocturnas: number
    feriadoDiurnas: number
    extraFeriadoDiurnas: number
    feriadoNocturnas: number
    extraFeriadoNocturnas: number
  }
  valores: {
    normales: number
    extraDiurnas: number
    normalNocturnas: number
    extraNocturnas: number
    feriadoDiurnas: number
    extraFeriadoDiurnas: number
    feriadoNocturnas: number
    extraFeriadoNocturnas: number
  }
  auxilioTransporte: number
  auxilioAlimentacion: number
  diasIncapacidad: number
  beneficioProductividad: number
  deducciones: {
    seguridadSocial: number
    polizaSura: number
    adelantoNomina: number
    otrosDescuentos: number
  }
  totalHoras: number
  totalValor: number
}

interface DocumentoInfo {
  titulo: string
  fechaInicio: string
  fechaFin: string
}

export default function ResumenEmpleados() {
  const { toast } = useToast()
  const [empleadoActivo, setEmpleadoActivo] = useState(empleados[0].nombre)
  const [documentoInfo, setDocumentoInfo] = useState<DocumentoInfo>({
    titulo: "PRIMERA QUINCENA ABRIL 2024",
    fechaInicio: "1/04/2024",
    fechaFin: "15/04/2024",
  })
  const [resumenesEmpleados, setResumenesEmpleados] = useState<ResumenEmpleadoUI[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [mesActual, setMesActual] = useState(new Date())
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<"primera" | "segunda">("primera")

  // Solo mantener esta variable para el UI
  const finMes = endOfMonth(mesActual)

  // Cargar datos de Firebase
  useEffect(() => {
    const cargarDatos = async () => {
      // Calcular fechas dentro del useEffect
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
      setIsLoading(true)
      try {
        // Actualizar título del documento según el período seleccionado
        const mesTexto = format(mesActual, "MMMM yyyy", { locale: es }).toUpperCase()
        const tituloDocumento =
          periodoSeleccionado === "primera" ? `PRIMERA QUINCENA ${mesTexto}` : `SEGUNDA QUINCENA ${mesTexto}`

        setDocumentoInfo({
          titulo: tituloDocumento,
          fechaInicio: format(fechaInicio, "d/MM/yyyy"),
          fechaFin: format(fechaFin, "d/MM/yyyy"),
        })

        // Cargar configuración del documento
        const configDocumento = await obtenerConfiguracion("documentoInfo")
        if (configDocumento) {
          setDocumentoInfo(configDocumento)
        }

        // Obtener todos los registros para el período seleccionado
        const registrosPeriodo = await obtenerRegistrosPorPeriodo(fechaInicio, fechaFin)

        // Generar resúmenes para cada empleado
        const resumenes = await Promise.all(
          empleados.map(async (empleado) => {
            // Filtrar registros del empleado
            const registrosEmpleado = registrosPeriodo.filter((r) => r.empleadoId === empleado.nombre)

            // Inicializar contadores
            const horas = {
              normales: 0,
              extraDiurnas: 0,
              normalNocturnas: 0,
              extraNocturnas: 0,
              feriadoDiurnas: 0,
              extraFeriadoDiurnas: 0,
              feriadoNocturnas: 0,
              extraFeriadoNocturnas: 0,
            }

            // Contar horas por tipo
            registrosEmpleado.forEach((registro) => {
              // Convertir horas a números para comparación
              const horasInicio = Number(registro.horaInicio.split(":")[0])
              const horasFin = Number(registro.horaFin.split(":")[0])

              // Calcular horas totales trabajadas
              let horasTotales = registro.horasTrabajadas

              if (registro.esHoraExtra && registro.cantidadHorasExtra) {
                // Si son horas extras, usar la cantidad específica
                const cantidadExtra = registro.cantidadHorasExtra || 0

                if (registro.esFeriado) {
                  if (registro.tipoHoraExtra === "nocturna") {
                    horas.extraFeriadoNocturnas += cantidadExtra
                  } else {
                    horas.extraFeriadoDiurnas += cantidadExtra
                  }
                } else {
                  if (registro.tipoHoraExtra === "nocturna") {
                    horas.extraNocturnas += cantidadExtra
                  } else {
                    horas.extraDiurnas += cantidadExtra
                  }
                }

                // Restar las horas extra del total para calcular las horas normales
                horasTotales -= cantidadExtra
              }

              // Distribuir las horas normales según el horario
              if (horasTotales > 0) {
                // Determinar si el turno cruza el límite diurno/nocturno
                const inicioEnHorasDiurnas = horasInicio >= 6 && horasInicio < 21
                const finEnHorasDiurnas = horasFin >= 6 && horasFin < 21

                if (inicioEnHorasDiurnas && finEnHorasDiurnas) {
                  // Todo el turno es diurno
                  if (registro.esFeriado) {
                    horas.feriadoDiurnas += horasTotales
                  } else {
                    horas.normales += horasTotales
                  }
                } else if (!inicioEnHorasDiurnas && !finEnHorasDiurnas) {
                  // Todo el turno es nocturno
                  if (registro.esFeriado) {
                    horas.feriadoNocturnas += horasTotales
                  } else {
                    horas.normalNocturnas += horasTotales
                  }
                } else {
                  // El turno cruza el límite, hay que dividirlo
                  let horasDiurnas = 0
                  let horasNocturnas = 0

                  // Caso 1: Inicia en horario diurno y termina en nocturno
                  if (inicioEnHorasDiurnas && !finEnHorasDiurnas) {
                    // Horas diurnas: desde inicio hasta 21:00
                    const horasHasta21 = 21 - horasInicio
                    horasDiurnas = horasHasta21
                    horasNocturnas = horasTotales - horasDiurnas
                  }
                  // Caso 2: Inicia en horario nocturno y termina en diurno
                  else if (!inicioEnHorasDiurnas && finEnHorasDiurnas) {
                    // Horas nocturnas: desde inicio hasta 6:00
                    const horasHasta6 = horasInicio < 6 ? 6 - horasInicio : 24 - horasInicio + 6
                    horasNocturnas = horasHasta6
                    horasDiurnas = horasTotales - horasNocturnas
                  }

                  // Asignar las horas calculadas
                  if (registro.esFeriado) {
                    horas.feriadoDiurnas += horasDiurnas
                    horas.feriadoNocturnas += horasNocturnas
                  } else {
                    horas.normales += horasDiurnas
                    horas.normalNocturnas += horasNocturnas
                  }
                }
              }
            })

            // Calcular valores
            const valores = {
              normales: horas.normales * empleado.valorHora,
              extraDiurnas: horas.extraDiurnas * empleado.horaExtraDiurna,
              normalNocturnas: horas.normalNocturnas * empleado.horaNormalNocturna,
              extraNocturnas: horas.extraNocturnas * empleado.horaExtraNocturna,
              feriadoDiurnas: horas.feriadoDiurnas * empleado.horaFeriadaDiurna,
              extraFeriadoDiurnas: horas.extraFeriadoDiurnas * empleado.horaExtraFeriadaDiurna,
              feriadoNocturnas: horas.feriadoNocturnas * empleado.horaNocturnaDiurna,
              extraFeriadoNocturnas: horas.extraFeriadoNocturnas * empleado.horaExtraFeriadaNocturna,
            }

            // Calcular totales
            const totalHoras = Object.values(horas).reduce((sum, h) => sum + h, 0)

            // Obtener deducciones guardadas
            const deduccionesKey = `deducciones_${empleado.nombre}`
            const deduccionesGuardadas = await obtenerConfiguracion(deduccionesKey)

            // Deducciones por defecto
            const deducciones = deduccionesGuardadas || {
              seguridadSocial: 0,
              polizaSura: 0,
              adelantoNomina: 0,
              otrosDescuentos: 0,
            }

            // Obtener beneficio de productividad
            const beneficioKey = `beneficio_${empleado.nombre}`
            const beneficioGuardado = await obtenerConfiguracion(beneficioKey)
            const beneficioProductividad = beneficioGuardado || 0

            // Obtener días de incapacidad
            const incapacidadKey = `incapacidad_${empleado.nombre}`
            const diasIncapacidadGuardados = await obtenerConfiguracion(incapacidadKey)
            const diasIncapacidad = diasIncapacidadGuardados || 0

            // Calcular valor de días de incapacidad
            const valorDiasIncapacidad = diasIncapacidad * empleado.valorDia

            // Calcular auxilio de transporte
            const auxilioTransporte = 100000

            return {
              empleado: empleado.nombre,
              cedula: empleado.cedula,
              cargo: empleado.cargo,
              salarioBase: empleado.salarioBase,
              periodo: {
                inicio: fechaInicio,
                fin: fechaFin,
              },
              horas,
              valores,
              auxilioTransporte,
              auxilioAlimentacion: 0,
              diasIncapacidad,
              beneficioProductividad,
              deducciones,
              totalHoras,
              totalValor: 0, // Se calculará después
            }
          }),
        )

        setResumenesEmpleados(resumenes)
      } catch (error) {
        console.error("Error al cargar datos:", error)
      } finally {
        setIsLoading(false)
      }
    }

    cargarDatos()
  }, [mesActual, periodoSeleccionado])

  const empleadoSeleccionado = resumenesEmpleados.find((e) => e.empleado === empleadoActivo)
  const empleado = empleados.find((e) => e.nombre === empleadoActivo)

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2">Cargando datos...</span>
        </div>
      </main>
    )
  }

  if (!empleadoSeleccionado) {
    return <div>Empleado no encontrado</div>
  }

  // Calcular valor de días de incapacidad
  const valorDiasIncapacidad = empleadoSeleccionado.diasIncapacidad * (empleado?.valorDia || 0)

  // Calcular valor de horas a la quincena
  const valorHorasQuincena =
    (empleadoSeleccionado.horas.normales +
      empleadoSeleccionado.horas.normalNocturnas +
      empleadoSeleccionado.horas.feriadoDiurnas +
      empleadoSeleccionado.horas.feriadoNocturnas) *
    (empleado?.valorHora || 0)

  // Calcular total devengado (suma de todos los valores de horas + auxilio transporte + días incapacidad)
  const totalDevengado =
    valorHorasQuincena +
    empleadoSeleccionado.valores.extraDiurnas +
    empleadoSeleccionado.valores.normalNocturnas +
    empleadoSeleccionado.valores.extraNocturnas +
    empleadoSeleccionado.valores.feriadoDiurnas +
    empleadoSeleccionado.valores.extraFeriadoDiurnas +
    empleadoSeleccionado.valores.feriadoNocturnas +
    empleadoSeleccionado.valores.extraFeriadoNocturnas +
    empleadoSeleccionado.auxilioTransporte +
    valorDiasIncapacidad

  // Calcular total deducciones (suma de seguridad social, póliza sura, adelanto nómina y otros descuentos)
  const totalDeducciones =
    empleadoSeleccionado.deducciones.seguridadSocial +
    empleadoSeleccionado.deducciones.polizaSura +
    empleadoSeleccionado.deducciones.adelantoNomina +
    empleadoSeleccionado.deducciones.otrosDescuentos

  // Calcular total a pagar (total devengado + beneficio productividad - total deducciones)
  const totalAPagar = totalDevengado + empleadoSeleccionado.beneficioProductividad - totalDeducciones

  const handleDocumentoInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocumentoInfo({
      ...documentoInfo,
      [e.target.name]: e.target.value,
    })
  }

  const guardarDocumentoInfo = async () => {
    try {
      await guardarConfiguracion("documentoInfo", documentoInfo)
      toast({
        title: "Información guardada",
        description: "La información del documento ha sido guardada correctamente",
      })
    } catch (error) {
      console.error("Error al guardar información del documento:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la información del documento",
        variant: "destructive",
      })
    }
  }

  const handleDeduccionesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    // Eliminar comas y convertir a número, pero mantener el valor como string en el estado
    const valorLimpio = value.replace(/,/g, "")

    setResumenesEmpleados(
      resumenesEmpleados.map((resumen) => {
        if (resumen.empleado === empleadoActivo) {
          return {
            ...resumen,
            deducciones: {
              ...resumen.deducciones,
              [name]: valorLimpio === "" ? 0 : Number(valorLimpio),
            },
          }
        }
        return resumen
      }),
    )
  }

  const handleBeneficioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorLimpio = e.target.value.replace(/,/g, "")

    setResumenesEmpleados(
      resumenesEmpleados.map((resumen) => {
        if (resumen.empleado === empleadoActivo) {
          return {
            ...resumen,
            beneficioProductividad: valorLimpio === "" ? 0 : Number(valorLimpio),
          }
        }
        return resumen
      }),
    )
  }

  const handleDiasIncapacidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorLimpio = e.target.value.replace(/,/g, "")

    setResumenesEmpleados(
      resumenesEmpleados.map((resumen) => {
        if (resumen.empleado === empleadoActivo) {
          return {
            ...resumen,
            diasIncapacidad: valorLimpio === "" ? 0 : Number(valorLimpio),
          }
        }
        return resumen
      }),
    )
  }

  const guardarDeduccionesBeneficios = async () => {
    try {
      const deduccionesKey = `deducciones_${empleadoActivo}`
      const beneficioKey = `beneficio_${empleadoActivo}`
      const incapacidadKey = `incapacidad_${empleadoActivo}`

      await guardarConfiguracion(deduccionesKey, empleadoSeleccionado.deducciones)
      await guardarConfiguracion(beneficioKey, empleadoSeleccionado.beneficioProductividad)
      await guardarConfiguracion(incapacidadKey, empleadoSeleccionado.diasIncapacidad)

      toast({
        title: "Información guardada",
        description: "Las deducciones, beneficios y días de incapacidad han sido guardados correctamente",
      })
    } catch (error) {
      console.error("Error al guardar deducciones y beneficios:", error)
      toast({
        title: "Error",
        description: "No se pudieron guardar las deducciones y beneficios",
        variant: "destructive",
      })
    }
  }

  // Función para guardar el resumen quincenal
  const guardarResumenQuincenal = async () => {
    setIsSaving(true)
    try {
      // Calcular fechas según el período seleccionado
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

      // Asegurarse de que todos los valores numéricos sean números válidos
      const horasNormales = Number(empleadoSeleccionado.horas.normales) || 0
      const horasExtraDiurnas = Number(empleadoSeleccionado.horas.extraDiurnas) || 0
      const horasNormalNocturnas = Number(empleadoSeleccionado.horas.normalNocturnas) || 0
      const horasExtraNocturnas = Number(empleadoSeleccionado.horas.extraNocturnas) || 0
      const horasFeriadoDiurnas = Number(empleadoSeleccionado.horas.feriadoDiurnas) || 0
      const horasExtraFeriadoDiurnas = Number(empleadoSeleccionado.horas.extraFeriadoDiurnas) || 0
      const horasFeriadoNocturnas = Number(empleadoSeleccionado.horas.feriadoNocturnas) || 0
      const horasExtraFeriadoNocturnas = Number(empleadoSeleccionado.horas.extraFeriadoNocturnas) || 0
      const auxilioTransporte = Number(empleadoSeleccionado.auxilioTransporte) || 0
      const auxilioAlimentacion = Number(empleadoSeleccionado.auxilioAlimentacion) || 0
      const diasIncapacidad = Number(empleadoSeleccionado.diasIncapacidad) || 0
      const beneficioProductividad = Number(empleadoSeleccionado.beneficioProductividad) || 0
      const seguridadSocial = Number(empleadoSeleccionado.deducciones.seguridadSocial) || 0
      const polizaSura = Number(empleadoSeleccionado.deducciones.polizaSura) || 0
      const adelantoNomina = Number(empleadoSeleccionado.deducciones.adelantoNomina) || 0
      const otrosDescuentos = Number(empleadoSeleccionado.deducciones.otrosDescuentos) || 0
      const totalAPagarNum = Number(totalAPagar) || 0

      // Crear objeto de resumen para guardar
      const resumen = {
        empleadoId: empleadoSeleccionado.empleado,
        periodo: {
          inicio: fechaInicio,
          fin: fechaFin,
        },
        horasNormales,
        horasExtraDiurnas,
        horasNormalNocturnas,
        horasExtraNocturnas,
        horasFeriadoDiurnas,
        horasExtraFeriadoDiurnas,
        horasFeriadoNocturnas,
        horasExtraFeriadoNocturnas,
        auxilioTransporte,
        auxilioAlimentacion,
        diasIncapacidad,
        beneficioProductividad,
        deducciones: {
          seguridadSocial,
          polizaSura,
          adelantoNomina,
          otrosDescuentos,
        },
        totalValor: totalAPagarNum,
        fechaGuardado: new Date(), // Añadir explícitamente la fecha de guardado
      }

      console.log("Guardando resumen quincenal:", JSON.stringify(resumen, null, 2))
      const id = await guardarResumenEmpleado(resumen)
      console.log("Resumen guardado con ID:", id)

      toast({
        title: "Resumen guardado",
        description: "El resumen quincenal ha sido guardado correctamente",
      })
    } catch (error) {
      console.error("Error al guardar resumen quincenal:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el resumen quincenal",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <Card className="mx-auto max-w-5xl">
        <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-2xl font-bold">Resumen por Empleado</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2"
              onClick={guardarResumenQuincenal}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Resumen Quincenal
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Editar Información del Documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Información del Documento</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="titulo" className="text-right">
                      Documento
                    </Label>
                    <Input
                      id="titulo"
                      name="titulo"
                      value={documentoInfo.titulo}
                      onChange={handleDocumentoInfoChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fechaInicio" className="text-right">
                      Fecha Inicio
                    </Label>
                    <Input
                      id="fechaInicio"
                      name="fechaInicio"
                      value={documentoInfo.fechaInicio}
                      onChange={handleDocumentoInfoChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="fechaFin" className="text-right">
                      Fecha Fin
                    </Label>
                    <Input
                      id="fechaFin"
                      name="fechaFin"
                      value={documentoInfo.fechaFin}
                      onChange={handleDocumentoInfoChange}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    onClick={guardarDocumentoInfo}
                    className="bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                  >
                    Guardar Cambios
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Editar Deducciones y Beneficios
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Deducciones y Beneficios</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <h3 className="font-medium">Deducciones</h3>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="seguridadSocial" className="text-right">
                      Seguridad Social
                    </Label>
                    <Input
                      id="seguridadSocial"
                      name="seguridadSocial"
                      value={empleadoSeleccionado.deducciones.seguridadSocial}
                      onChange={handleDeduccionesChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="polizaSura" className="text-right">
                      Póliza Sura
                    </Label>
                    <Input
                      id="polizaSura"
                      name="polizaSura"
                      value={empleadoSeleccionado.deducciones.polizaSura}
                      onChange={handleDeduccionesChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="adelantoNomina" className="text-right">
                      Adelanto Nómina
                    </Label>
                    <Input
                      id="adelantoNomina"
                      name="adelantoNomina"
                      value={empleadoSeleccionado.deducciones.adelantoNomina}
                      onChange={handleDeduccionesChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="otrosDescuentos" className="text-right">
                      Otros Descuentos
                    </Label>
                    <Input
                      id="otrosDescuentos"
                      name="otrosDescuentos"
                      value={empleadoSeleccionado.deducciones.otrosDescuentos}
                      onChange={handleDeduccionesChange}
                      className="col-span-6"
                    />
                  </div>

                  <h3 className="font-medium mt-4">Beneficios</h3>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="beneficioProductividad" className="text-right">
                      Beneficio por Productividad
                    </Label>
                    <Input
                      id="beneficioProductividad"
                      name="beneficioProductividad"
                      value={empleadoSeleccionado.beneficioProductividad}
                      onChange={handleBeneficioChange}
                      className="col-span-6"
                    />
                  </div>

                  <h3 className="font-medium mt-4">Incapacidad</h3>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="diasIncapacidad" className="text-right">
                      Días de Incapacidad
                    </Label>
                    <Input
                      id="diasIncapacidad"
                      name="diasIncapacidad"
                      value={empleadoSeleccionado.diasIncapacidad}
                      onChange={handleDiasIncapacidadChange}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" onClick={guardarDeduccionesBeneficios}>
                    Guardar Cambios
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Selector de mes y quincena */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setMesActual(subMonths(mesActual, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-medium">{format(mesActual, "MMMM yyyy", { locale: es })}</span>
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

          <Tabs defaultValue={empleadoActivo} onValueChange={setEmpleadoActivo} className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
              {empleados.map((empleado) => (
                <TabsTrigger key={empleado.nombre} value={empleado.nombre} className="text-xs md:text-sm">
                  {empleado.nombre.split(" ")[0]}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={empleadoActivo} className="mt-4 space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="text-gray-500">EMPRESA:</div>
                        <div className="font-medium">OSCAR EDUARDO RAMOS ACEVEDO</div>

                        <div className="text-gray-500">DOCUMENTO:</div>
                        <div className="font-medium">{documentoInfo.titulo}</div>

                        <div className="text-gray-500">CEDULA:</div>
                        <div className="font-medium">{empleadoSeleccionado.cedula}</div>

                        <div className="text-gray-500">NOMBRE:</div>
                        <div className="font-medium">{empleadoSeleccionado.empleado}</div>
                      </div>
                    </div>

                    <div>
                      <div className="grid grid-cols-[120px_1fr] gap-2">
                        <div className="text-gray-500">FECHA:</div>
                        <div className="font-medium">
                          {documentoInfo.fechaInicio} AL {documentoInfo.fechaFin}
                        </div>

                        <div className="text-gray-500">CARGO:</div>
                        <div className="font-medium">{empleadoSeleccionado.cargo}</div>

                        <div className="text-gray-500">SUELDO:</div>
                        <div className="font-medium">${empleadoSeleccionado.salarioBase.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
                    <div className="border rounded-md">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted">
                            <th className="p-3 text-left">DESCRIPCIÓN</th>
                            <th className="p-3 text-right">CAN/SALDO</th>
                            <th className="p-3 text-right">Valor Unitario</th>
                            <th className="p-3 text-right">DEVENGADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b bg-muted">
                            <td className="p-3 font-medium">HORAS A LA QUINCENA</td>
                            <td className="p-3 text-right font-medium">
                              {(
                                empleadoSeleccionado.horas.normales +
                                empleadoSeleccionado.horas.normalNocturnas +
                                empleadoSeleccionado.horas.feriadoDiurnas +
                                empleadoSeleccionado.horas.feriadoNocturnas
                              ).toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-medium">${empleado?.valorHora.toLocaleString() || 0}</td>
                            <td className="p-3 text-right font-medium">
                              $
                              {(
                                (empleadoSeleccionado.horas.normales +
                                  empleadoSeleccionado.horas.normalNocturnas +
                                  empleadoSeleccionado.horas.feriadoDiurnas +
                                  empleadoSeleccionado.horas.feriadoNocturnas) *
                                (empleado?.valorHora || 0)
                              ).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS EXTRA DIURNAS (HED)</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.horas.extraDiurnas.toFixed(2)}</td>
                            <td className="p-3 text-right">${empleado?.horaExtraDiurna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.extraDiurnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS NORMAL NOCTURNAS (HNN)</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.horas.normalNocturnas.toFixed(2)}</td>
                            <td className="p-3 text-right">${empleado?.horaNormalNocturna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.normalNocturnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS EXTRA NOCTURNAS (HEN)</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.horas.extraNocturnas.toFixed(2)}</td>
                            <td className="p-3 text-right">${empleado?.horaExtraNocturna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.extraNocturnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS FERIADO DIURNAS (HFD)</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.horas.feriadoDiurnas.toFixed(2)}</td>
                            <td className="p-3 text-right">${empleado?.horaFeriadaDiurna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.feriadoDiurnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS EXTRA FERIADO DIURNAS (HEFD)</td>
                            <td className="p-3 text-right">
                              {empleadoSeleccionado.horas.extraFeriadoDiurnas.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">${empleado?.horaExtraFeriadaDiurna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.extraFeriadoDiurnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS FERIADO NOCTURNAS (HFN)</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.horas.feriadoNocturnas.toFixed(2)}</td>
                            <td className="p-3 text-right">${empleado?.horaNocturnaDiurna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.feriadoNocturnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">HORAS EXTRA FERIADO NOCTURNAS (HEFN)</td>
                            <td className="p-3 text-right">
                              {empleadoSeleccionado.horas.extraFeriadoNocturnas.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">${empleado?.horaExtraFeriadaNocturna.toLocaleString() || 0}</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.valores.extraFeriadoNocturnas.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">AUXILIO TRANSPORTE</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.auxilioTransporte.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">AUXILIO DE ALIMENTACIÓN</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">$0</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">DÍAS INCAPACIDAD</td>
                            <td className="p-3 text-right">{empleadoSeleccionado.diasIncapacidad}</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">${valorDiasIncapacidad.toLocaleString()}</td>
                          </tr>
                          <tr className="border-b font-semibold bg-muted">
                            <td className="p-3">TOTAL DEVENGADO:</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">${totalDevengado.toLocaleString()}</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">BENEFICIO POR PRODUCTIVIDAD</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.beneficioProductividad.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="font-semibold bg-muted">
                            <td className="p-3"></td>
                            <td className="p-3 text-right">TOTAL</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right">${totalAPagar.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="border rounded-md">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted">
                            <th className="p-3 text-left">DESCRIPCIÓN</th>
                            <th className="p-3 text-right">DEDUCCION</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3">SEGURIDAD SOCIAL</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.deducciones.seguridadSocial.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">ADELANTO NÓMINA</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.deducciones.adelantoNomina.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-3">OTROS DSCTS</td>
                            <td className="p-3 text-right">
                              ${empleadoSeleccionado.deducciones.otrosDescuentos.toLocaleString()}
                            </td>
                          </tr>
                          <tr className="font-semibold bg-muted">
                            <td className="p-3">TOTAL DEDUCCIONES:</td>
                            <td className="p-3 text-right">${totalDeducciones.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-8 border-t pt-4">
                    <p className="font-semibold">FIRMA RECIBIDO: _____________________________</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Distribución de Horas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries({
                      "Normales (N)": empleadoSeleccionado.horas.normales,
                      "Extra Diurnas (HED)": empleadoSeleccionado.horas.extraDiurnas,
                      "Normal Nocturnas (HNN)": empleadoSeleccionado.horas.normalNocturnas,
                      "Extra Nocturnas (HEN)": empleadoSeleccionado.horas.extraNocturnas,
                      "Feriado Diurnas (HFD)": empleadoSeleccionado.horas.feriadoDiurnas,
                      "Extra Feriado Diurnas (HEFD)": empleadoSeleccionado.horas.extraFeriadoDiurnas,
                      "Feriado Nocturnas (HFN)": empleadoSeleccionado.horas.feriadoNocturnas,
                      "Extra Feriado Nocturnas (HEFN)": empleadoSeleccionado.horas.extraFeriadoNocturnas,
                    }).map(([tipo, horas]) => {
                      const porcentaje = (horas / empleadoSeleccionado.totalHoras) * 100
                      return (
                        <div key={tipo} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{tipo}</span>
                            <span>
                              {horas.toFixed(2)} horas ({porcentaje.toFixed(1)}%)
                            </span>
                          </div>
                          <Progress value={porcentaje} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  )
}
