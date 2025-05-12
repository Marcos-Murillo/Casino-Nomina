"use client"

import { useState, useEffect } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Checkbox } from "../components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useToast } from "../hooks/use-toast"
import { empleados, type RegistroHora } from "../data/empleados"
import { obtenerRegistrosHoras, guardarRegistroHora, eliminarRegistroHora } from "../firebase/services"

// Definir el esquema para el formulario de edición
const formSchema = z.object({
  empleadoId: z.string({
    required_error: "Por favor selecciona un empleado",
  }),
  fecha: z.date({
    required_error: "Por favor selecciona una fecha",
  }),
  horaInicio: z.string().regex(/^([01]?[0-9]|2[0-3]|24):([0-5][0-9])$/, {
    message: "Formato de hora inválido. Use HH:MM (24h)",
  }),
  horaFin: z.string().regex(/^([01]?[0-9]|2[0-3]|24):([0-5][0-9])$/, {
    message: "Formato de hora inválido. Use HH:MM (24h)",
  }),
  esFeriado: z.boolean().default(false),
  esHoraExtra: z.boolean().default(false),
  tipoHoraExtra: z.enum(["diurna", "nocturna"]).optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function CalendarioHorarios() {
  const { toast } = useToast()
  const [mesActual, setMesActual] = useState(new Date())
  const [registros, setRegistros] = useState<RegistroHora[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroHora | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null)
  const [isNuevoHorarioDialogOpen, setIsNuevoHorarioDialogOpen] = useState(false)
  const [isDataLoaded, setIsDataLoaded] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      empleadoId: "",
      horaInicio: "",
      horaFin: "",
      esFeriado: false,
      esHoraExtra: false,
    },
  })

  const formNuevoHorario = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      empleadoId: "",
      horaInicio: "",
      horaFin: "",
      esFeriado: false,
      esHoraExtra: false,
    },
  })

  // Observar cambios en esHoraExtra para resetear tipoHoraExtra cuando se desmarca
  const esHoraExtra = form.watch("esHoraExtra")
  const esHoraExtraNuevo = formNuevoHorario.watch("esHoraExtra")

  useEffect(() => {
    if (!esHoraExtra) {
      form.setValue("tipoHoraExtra", undefined)
    }
  }, [esHoraExtra, form])

  useEffect(() => {
    if (!esHoraExtraNuevo) {
      formNuevoHorario.setValue("tipoHoraExtra", undefined)
    }
  }, [esHoraExtraNuevo, formNuevoHorario])

  // Calcular inicio y fin del mes
  const inicioMes = startOfMonth(mesActual)
  const finMes = endOfMonth(mesActual)

  // Cargar registros al cambiar el mes
  useEffect(() => {
    const cargarRegistros = async () => {
      setIsLoading(true)
      try {
        const data = await obtenerRegistrosHoras()
        // Filtrar registros para el mes actual
        const registrosFiltrados = data.filter((registro) => {
          const fechaRegistro = new Date(registro.fecha)
          return fechaRegistro >= inicioMes && fechaRegistro <= finMes
        })
        setRegistros(registrosFiltrados)
      } catch (error) {
        console.error("Error al cargar registros:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los registros",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setIsDataLoaded(true)
      }
    }

    cargarRegistros()
  }, [inicioMes, finMes, toast])

  // Función para determinar el tipo de recargo según la nueva lógica
  function determinarTipoRecargo(
    horaInicio: string,
    horaFin: string,
    esFeriado: boolean,
    esHoraExtra: boolean,
    tipoHoraExtra?: string,
  ): string {
    // Convertir horas a números para comparación
    let [horasInicio, minutosInicio] = horaInicio.split(":").map(Number)
    let [horasFin, minutosFin] = horaFin.split(":").map(Number)

    // Manejar caso especial de 24:00
    if (horasInicio === 24) horasInicio = 0
    if (horasFin === 24) horasFin = 0

    // Si es feriado
    if (esFeriado) {
      if (esHoraExtra) {
        return tipoHoraExtra === "nocturna" ? "HEFN" : "HEFD"
      } else {
        // Verificar si es horario nocturno (9pm-6am)
        const esNocturno = horasInicio >= 21 || horasInicio < 6 || horasFin >= 21 || horasFin < 6
        return esNocturno ? "HFN" : "HFD"
      }
    }
    // Si no es feriado pero es hora extra
    else if (esHoraExtra) {
      return tipoHoraExtra === "nocturna" ? "HEN" : "HED"
    }
    // Horario normal
    else {
      // Verificar si es horario nocturno (9pm-6am)
      const esNocturno = horasInicio >= 21 || horasInicio < 6 || horasFin >= 21 || horasFin < 6
      return esNocturno ? "HNN" : "Normal"
    }
  }

  // Función para calcular horas trabajadas considerando horario diurno y nocturno
  function calcularHorasTrabajadas(horaInicio: string, horaFin: string): number {
    // Convertir horas a objetos Date para cálculos
    let inicio = new Date(`2000-01-01T${horaInicio}:00`)
    let fin = new Date(`2000-01-01T${horaFin}:00`)

    // Manejar caso especial de 24:00
    if (horaInicio === "24:00") inicio = new Date(`2000-01-02T00:00:00`)
    if (horaFin === "24:00") fin = new Date(`2000-01-02T00:00:00`)

    // Si la hora de fin es menor que la de inicio, asumimos que cruza la medianoche
    if (fin < inicio) {
      fin = new Date(`2000-01-02T${horaFin}:00`)
    }

    // Calcular diferencia en horas
    const horasTrabajadas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)
    return horasTrabajadas
  }

  // Función para editar un registro
  const editarRegistro = (registro: RegistroHora) => {
    setRegistroSeleccionado(registro)
    form.reset({
      empleadoId: registro.empleadoId,
      fecha: new Date(registro.fecha),
      horaInicio: registro.horaInicio,
      horaFin: registro.horaFin,
      esFeriado: registro.esFeriado,
      esHoraExtra: registro.esHoraExtra || false,
      tipoHoraExtra: registro.tipoHoraExtra,
    })
    setIsDialogOpen(true)
  }

  // Función para abrir el diálogo de nuevo horario
  const abrirDialogoNuevoHorario = (fecha: Date) => {
    setDiaSeleccionado(fecha)
    formNuevoHorario.reset({
      empleadoId: "",
      fecha: fecha,
      horaInicio: "",
      horaFin: "",
      esFeriado: false,
      esHoraExtra: false,
      tipoHoraExtra: undefined,
    })
    setIsNuevoHorarioDialogOpen(true)
  }

  // Función para guardar cambios en un registro
  const onSubmit = async (values: FormValues) => {
    if (!registroSeleccionado || !registroSeleccionado.id) return

    setIsLoading(true)
    try {
      const tipoRecargo = determinarTipoRecargo(
        values.horaInicio,
        values.horaFin,
        values.esFeriado,
        values.esHoraExtra,
        values.tipoHoraExtra,
      )

      // Calcular horas trabajadas
      const horasTrabajadas = calcularHorasTrabajadas(values.horaInicio, values.horaFin)

      // Actualizar el registro
      const registroActualizado: RegistroHora = {
        id: registroSeleccionado.id,
        empleadoId: values.empleadoId,
        fecha: values.fecha,
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        esFeriado: values.esFeriado,
        esHoraExtra: values.esHoraExtra,
        tipoHoraExtra: values.tipoHoraExtra,
        tipoRecargo,
        horasTrabajadas,
      }

      // Eliminar el registro anterior y crear uno nuevo
      await eliminarRegistroHora(registroSeleccionado.id)
      await guardarRegistroHora(registroActualizado)

      // Actualizar la lista de registros
      setRegistros(registros.map((r) => (r.id === registroSeleccionado.id ? registroActualizado : r)))

      toast({
        title: "Registro actualizado",
        description: "El horario ha sido actualizado correctamente",
      })

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error al actualizar registro:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar el registro",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Función para guardar un nuevo horario
  const onSubmitNuevoHorario = async (values: FormValues) => {
    if (!diaSeleccionado) return

    setIsLoading(true)
    try {
      const tipoRecargo = determinarTipoRecargo(
        values.horaInicio,
        values.horaFin,
        values.esFeriado,
        values.esHoraExtra,
        values.tipoHoraExtra,
      )

      // Calcular horas trabajadas
      const horasTrabajadas = calcularHorasTrabajadas(values.horaInicio, values.horaFin)

      // Crear nuevo registro sin ID (Firebase lo generará)
      const nuevoRegistro: RegistroHora = {
        empleadoId: values.empleadoId,
        fecha: values.fecha,
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        esFeriado: values.esFeriado,
        esHoraExtra: values.esHoraExtra,
        tipoHoraExtra: values.tipoHoraExtra,
        tipoRecargo,
        horasTrabajadas,
      }

      // Guardar en Firebase
      try {
        const id = await guardarRegistroHora(nuevoRegistro)

        // Actualizar la lista de registros con el ID devuelto por Firebase
        setRegistros([...registros, { ...nuevoRegistro, id }])

        toast({
          title: "Horario registrado",
          description: "El nuevo horario ha sido registrado correctamente",
        })

        setIsNuevoHorarioDialogOpen(false)
      } catch (firebaseError: any) {
        console.error("Error específico de Firebase:", firebaseError)
        toast({
          title: "Error de base de datos",
          description:
            "No se pudo guardar en la base de datos. Detalles: " + (firebaseError.message || "Error desconocido"),
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error al registrar horario:", error)
      toast({
        title: "Error",
        description: "No se pudo registrar el horario. Verifique los datos ingresados. " + error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Generar días del mes
  const diasDelMes = eachDayOfInterval({ start: inicioMes, end: finMes })

  // Obtener el día de la semana del primer día del mes (0 = domingo, 1 = lunes, etc.)
  const primerDiaSemana = getDay(inicioMes)

  // Crear array con días vacíos para completar la primera semana
  const diasVaciosInicio = Array(primerDiaSemana).fill(null)

  // Combinar días vacíos y días del mes
  const diasCalendario = [...diasVaciosInicio, ...diasDelMes]

  // Agrupar registros por día
  const registrosPorDia: Record<string, RegistroHora[]> = {}

  diasDelMes.forEach((dia) => {
    const fechaStr = format(dia, "yyyy-MM-dd")
    registrosPorDia[fechaStr] = []
  })

  registros.forEach((registro) => {
    const fechaStr = format(new Date(registro.fecha), "yyyy-MM-dd")
    if (registrosPorDia[fechaStr]) {
      registrosPorDia[fechaStr].push(registro)
    }
  })

  // Función para obtener color según tipo de recargo
  const getColorByTipoRecargo = (tipo: string) => {
    switch (tipo) {
      case "Normal":
        return "bg-muted"
      case "HED":
        return "bg-muted"
      case "HNN":
        return "bg-muted"
      case "HEN":
        return "bg-muted"
      case "HFD":
        return "bg-muted"
      case "HEFD":
        return "bg-muted"
      case "HFN":
        return "bg-muted"
      case "HEFN":
        return "bg-muted"
      default:
        return "bg-muted"
    }
  }

  // Si los datos aún no se han cargado, mostrar un estado de carga
  if (!isDataLoaded) {
    return (
      <main className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg">Cargando calendario de horarios...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <Card className="mx-auto max-w-7xl">
        <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-2xl font-bold">Calendario de Horarios</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setMesActual(subMonths(mesActual, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium">{format(mesActual, "MMMM yyyy", { locale: es })}</span>
            <Button variant="outline" onClick={() => setMesActual(addMonths(mesActual, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {/* Encabezados de días de la semana */}
            {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((dia) => (
              <div key={dia} className="text-center font-medium p-2">
                {dia}
              </div>
            ))}

            {/* Días del calendario */}
            {diasCalendario.map((dia, index) => {
              if (!dia) {
                // Día vacío para completar la primera semana
                return <div key={`empty-${index}`} className="h-36"></div>
              }

              const fechaStr = format(dia, "yyyy-MM-dd")
              const registrosDia = registrosPorDia[fechaStr] || []
              const esDiaActual = isSameDay(dia, new Date())

              return (
                <Card key={fechaStr} className={`h-36 relative ${esDiaActual ? "border-blue-500 border-2" : ""}`}>
                  <div className="absolute top-1 right-2 font-bold text-sm">{format(dia, "d")}</div>
                  <CardContent className="p-2 pt-6 overflow-y-auto h-[calc(100%-30px)]">
                    {registrosDia.length > 0 ? (
                      <div className="space-y-1">
                        {registrosDia.map((registro, idx) => (
                          <div
                            key={idx}
                            className={`rounded p-1 text-xs ${getColorByTipoRecargo(registro.tipoRecargo)} cursor-pointer hover:opacity-80`}
                            onClick={() => editarRegistro(registro)}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium truncate">
                                {registro.horaInicio}-{registro.horaFin}
                              </span>
                            </div>
                            <div className="truncate">{registro.empleadoId.split(" ")[0]}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-xs text-gray-400 h-full flex items-center justify-center">
                        Sin horarios
                      </div>
                    )}
                  </CardContent>
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-full bg-muted hover:bg-gray-200"
                      onClick={() => abrirDialogoNuevoHorario(dia)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Diálogo para editar horario */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Horario</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="empleadoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un empleado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empleados.map((empleado) => (
                          <SelectItem key={empleado.nombre} value={empleado.nombre}>
                            {empleado.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="horaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de Inicio</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM (24h)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="horaFin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de Fin</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM (24h)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="esFeriado"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Día Feriado</FormLabel>
                      <p className="text-sm text-gray-500">Marque esta casilla si el día es feriado</p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="esHoraExtra"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Hora Extra</FormLabel>
                      <p className="text-sm text-gray-500">
                        Marque esta casilla si las horas trabajadas son horas extras
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch("esHoraExtra") && (
                <FormField
                  control={form.control}
                  name="tipoHoraExtra"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Hora Extra</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="diurna" />
                            </FormControl>
                            <FormLabel className="font-normal">Diurna (6am - 9pm)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="nocturna" />
                            </FormControl>
                            <FormLabel className="font-normal">Nocturna (9pm - 6am)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diálogo para nuevo horario */}
      <Dialog open={isNuevoHorarioDialogOpen} onOpenChange={setIsNuevoHorarioDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Nuevo Horario - {diaSeleccionado ? format(diaSeleccionado, "dd/MM/yyyy", { locale: es }) : ""}
            </DialogTitle>
          </DialogHeader>
          <Form {...formNuevoHorario}>
            <form onSubmit={formNuevoHorario.handleSubmit(onSubmitNuevoHorario)} className="space-y-4">
              <FormField
                control={formNuevoHorario.control}
                name="empleadoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empleado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un empleado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empleados.map((empleado) => (
                          <SelectItem key={empleado.nombre} value={empleado.nombre}>
                            {empleado.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={formNuevoHorario.control}
                  name="horaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de Inicio</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM (24h)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formNuevoHorario.control}
                  name="horaFin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora de Fin</FormLabel>
                      <FormControl>
                        <Input placeholder="HH:MM (24h)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={formNuevoHorario.control}
                name="esFeriado"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Día Feriado</FormLabel>
                      <p className="text-sm text-gray-500">Marque esta casilla si el día es feriado</p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={formNuevoHorario.control}
                name="esHoraExtra"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Hora Extra</FormLabel>
                      <p className="text-sm text-gray-500">
                        Marque esta casilla si las horas trabajadas son horas extras
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {formNuevoHorario.watch("esHoraExtra") && (
                <FormField
                  control={formNuevoHorario.control}
                  name="tipoHoraExtra"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Hora Extra</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="diurna" />
                            </FormControl>
                            <FormLabel className="font-normal">Diurna (6am - 9pm)</FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="nocturna" />
                            </FormControl>
                            <FormLabel className="font-normal">Nocturna (9pm - 6am)</FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsNuevoHorarioDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar Horario
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
