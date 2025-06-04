"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

import { Button } from "../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../components/ui/form"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Calendar } from "../components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover"
import { Checkbox } from "../components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import { cn } from "@/lib/utils"
import { useToast } from "../hooks/use-toast"
import { empleados, type RegistroHora, tiposRecargo } from "../data/empleados"
import { guardarRegistroHora, obtenerRegistrosHoras } from "../firebase/services"

// Definir el esquema de formulario con zod - TODOS LOS CAMPOS OBLIGATORIOS
const formSchema = z.object({
  empleadoId: z
    .string({
      required_error: "Por favor selecciona un empleado",
    })
    .min(1, "El empleado es obligatorio"),
  fecha: z.date({
    required_error: "Por favor selecciona una fecha",
  }),
  horaInicio: z
    .string({
      required_error: "La hora de inicio es obligatoria",
    })
    .regex(/^([01]?[0-9]|2[0-3]|24):([0-5][0-9])$/, {
      message: "Formato de hora inválido. Use HH:MM (24h)",
    })
    .min(1, "La hora de inicio es obligatoria"),
  horaFin: z
    .string({
      required_error: "La hora de fin es obligatoria",
    })
    .regex(/^([01]?[0-9]|2[0-3]|24):([0-5][0-9])$/, {
      message: "Formato de hora inválido. Use HH:MM (24h)",
    })
    .min(1, "La hora de fin es obligatoria"),
  esFeriado: z.boolean().default(false),
  esHoraExtra: z.boolean().default(false),
  cantidadHorasExtra: z.string().optional(),
  tipoHoraExtra: z.enum(["diurna", "nocturna"]).optional(),
})

// Define el tipo para los valores del formulario
type FormValues = z.infer<typeof formSchema>

export default function RegistroHoras() {
  const { toast } = useToast()
  const [registros, setRegistros] = useState<RegistroHora[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      empleadoId: "",
      horaInicio: "",
      horaFin: "",
      esFeriado: false,
      esHoraExtra: false,
      cantidadHorasExtra: "",
      tipoHoraExtra: "diurna", // Valor predeterminado
    },
  })

  // Observar cambios en esHoraExtra para resetear tipoHoraExtra cuando se desmarca
  const esHoraExtra = form.watch("esHoraExtra")
  useEffect(() => {
    if (!esHoraExtra) {
      form.setValue("tipoHoraExtra", undefined)
      form.setValue("cantidadHorasExtra", "")
    } else if (!form.getValues("tipoHoraExtra")) {
      // Si se marca hora extra pero no hay tipo seleccionado, establecer valor predeterminado
      form.setValue("tipoHoraExtra", "diurna")
    }
  }, [esHoraExtra, form])

  // Cargar registros al iniciar
  useEffect(() => {
    const cargarRegistros = async () => {
      try {
        const data = await obtenerRegistrosHoras()
        setRegistros(data)
      } catch (error) {
        console.error("Error al cargar registros:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar los registros",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    cargarRegistros()
  }, [toast])

  // Función para determinar el tipo de recargo según la nueva lógica
  function determinarTipoRecargo(
    horaInicio: string,
    horaFin: string,
    esFeriado: boolean,
    esHoraExtra: boolean,
    tipoHoraExtra?: string,
  ): string {
    // Si es hora extra, usar el tipo de hora extra directamente
    if (esHoraExtra) {
      if (esFeriado) {
        return tipoHoraExtra === "nocturna" ? "HEFN" : "HEFD"
      } else {
        return tipoHoraExtra === "nocturna" ? "HEN" : "HED"
      }
    }

    // Si no es hora extra, determinar por el horario
    // Convertir horas a números para comparación
    const [horasInicio] = horaInicio.split(":").map(Number)
    const [horasFin] = horaFin.split(":").map(Number)

    // Determinar si es horario nocturno (21:00-06:00)
    const esNocturno = horasInicio >= 21 || horasInicio < 6

    if (esFeriado) {
      return esNocturno ? "HFN" : "HFD"
    } else {
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

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    try {
      // Asegurarse de que tipoHoraExtra tenga un valor cuando esHoraExtra es true
      if (values.esHoraExtra && !values.tipoHoraExtra) {
        values.tipoHoraExtra = "diurna" // Valor predeterminado
      }

      const tipoRecargo = determinarTipoRecargo(
        values.horaInicio,
        values.horaFin,
        values.esFeriado,
        values.esHoraExtra,
        values.tipoHoraExtra,
      )

      // Calcular horas trabajadas
      const horasTrabajadas = calcularHorasTrabajadas(values.horaInicio, values.horaFin)

      // Determinar horas extras (si aplica)
      const cantidadHorasExtra =
        values.esHoraExtra && values.cantidadHorasExtra ? Number.parseFloat(values.cantidadHorasExtra) : 0

      const nuevoRegistro: RegistroHora = {
        id: uuidv4(),
        empleadoId: values.empleadoId,
        fecha: values.fecha,
        horaInicio: values.horaInicio,
        horaFin: values.horaFin,
        esFeriado: values.esFeriado,
        esHoraExtra: values.esHoraExtra,
        cantidadHorasExtra: cantidadHorasExtra,
        tipoHoraExtra: values.esHoraExtra ? values.tipoHoraExtra : undefined,
        tipoRecargo,
        horasTrabajadas,
      }

      console.log("Guardando registro:", nuevoRegistro)

      // Guardar en Firebase
      await guardarRegistroHora(nuevoRegistro)

      // Actualizar estado local
      setRegistros([nuevoRegistro, ...registros])

      toast({
        title: "Registro guardado",
        description: `Se registraron ${horasTrabajadas.toFixed(2)} horas para ${values.empleadoId}`,
      })

      form.reset({
        empleadoId: "",
        fecha: undefined,
        horaInicio: "",
        horaFin: "",
        esFeriado: false,
        esHoraExtra: false,
        cantidadHorasExtra: "",
        tipoHoraExtra: "diurna", // Valor predeterminado
      })
    } catch (error) {
      console.error("Error al guardar registro:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el registro",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Registro de Horas Trabajadas</CardTitle>
          <CardDescription>
            Ingresa las horas trabajadas por cada empleado. Todos los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="empleadoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Empleado <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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

              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-foreground">
                      Fecha <span className="text-red-500">*</span>
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          disabled={false}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="horaInicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">
                        Hora de Inicio <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="HH:MM (24h)" className="pl-10" {...field} />
                        </div>
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
                      <FormLabel className="text-foreground">
                        Hora de Fin <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="HH:MM (24h)" className="pl-10" {...field} />
                        </div>
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
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-foreground">Día Feriado</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Marque esta casilla si el día es feriado (independientemente de si es domingo)
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="esHoraExtra"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-primary"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-foreground">Hora Extra</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Marque esta casilla si las horas trabajadas incluyen horas extras
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch("esHoraExtra") && (
                <>
                  <FormField
                    control={form.control}
                    name="cantidadHorasExtra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground">Cantidad de Horas Extra</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="Ej: 2.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipoHoraExtra"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-foreground">Tipo de Hora Extra</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value || "diurna"} // Asegurar que siempre haya un valor
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="diurna" />
                              </FormControl>
                              <FormLabel className="font-normal text-foreground">Diurna (6am - 9pm)</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="nocturna" />
                              </FormControl>
                              <FormLabel className="font-normal text-foreground">Nocturna (9pm - 6am)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Registrar Horas"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col">
          <h3 className="mb-4 text-xl font-semibold text-foreground">Registros Recientes</h3>
          <div className="w-full overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 text-left text-foreground">Empleado</th>
                  <th className="p-2 text-left text-foreground">Fecha</th>
                  <th className="p-2 text-left text-foreground">Horario</th>
                  <th className="p-2 text-left text-foreground">Horas</th>
                  <th className="p-2 text-left text-foreground">Tipo</th>
                  <th className="p-2 text-left text-foreground">Feriado</th>
                  <th className="p-2 text-left text-foreground">Hora Extra</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      Cargando registros...
                    </td>
                  </tr>
                ) : registros.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      No hay registros aún
                    </td>
                  </tr>
                ) : (
                  registros.map((registro) => (
                    <tr key={registro.id} className="border-b border-border">
                      <td className="p-2 text-foreground">{registro.empleadoId}</td>
                      <td className="p-2 text-foreground">{format(new Date(registro.fecha), "dd/MM/yyyy")}</td>
                      <td className="p-2 text-foreground">{`${registro.horaInicio} - ${registro.horaFin}`}</td>
                      <td className="p-2 text-foreground">{registro.horasTrabajadas.toFixed(2)}</td>
                      <td className="p-2 text-foreground">
                        {registro.tipoRecargo in tiposRecargo
                          ? tiposRecargo[registro.tipoRecargo as keyof typeof tiposRecargo]
                          : registro.tipoRecargo}
                      </td>
                      <td className="p-2 text-foreground">{registro.esFeriado ? "Sí" : "No"}</td>
                      <td className="p-2 text-foreground">
                        {registro.esHoraExtra
                          ? `${registro.cantidadHorasExtra || 0} hrs (${registro.tipoHoraExtra === "diurna" ? "Diurna" : "Nocturna"})`
                          : "No"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
