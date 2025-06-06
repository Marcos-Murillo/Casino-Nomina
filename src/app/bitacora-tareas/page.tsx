"use client"

import { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Badge } from "../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { useToast } from "../hooks/use-toast"
import { Plus, Trash2, Check, Calendar, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { format, isBefore, startOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { guardarTarea, obtenerTareas, actualizarTarea, eliminarTarea, type Tarea } from "@/app/firebase/services"

const tareaSchema = z.object({
  titulo: z.string().min(1, "El título es obligatorio"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  fechaLimite: z.string().min(1, "La fecha límite es obligatoria"),
})

type TareaFormData = z.infer<typeof tareaSchema>

export default function BitacoraTareas() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [filtro, setFiltro] = useState<"todas" | "completadas" | "pendientes">("todas")
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TareaFormData>({
    resolver: zodResolver(tareaSchema),
  })

  // Cargar tareas desde Firebase al iniciar
  useEffect(() => {
    const cargarTareas = async () => {
      try {
        setIsLoadingData(true)
        console.log("Cargando tareas desde Firebase...")
        const tareasFirebase = await obtenerTareas()
        console.log("Tareas cargadas:", tareasFirebase)
        setTareas(tareasFirebase)
      } catch (error) {
        console.error("Error al cargar tareas:", error)
        toast({
          title: "Error",
          description: "No se pudieron cargar las tareas.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingData(false)
        setIsDataLoaded(true)
      }
    }

    cargarTareas()
  }, [toast])

  // Función para agregar nueva tarea
  const onSubmit = async (data: TareaFormData) => {
    setIsLoading(true)
    try {
      const nuevaTarea: Omit<Tarea, "id"> = {
        titulo: data.titulo,
        descripcion: data.descripcion,
        fechaLimite: new Date(data.fechaLimite),
        completada: false,
        fechaCreacion: new Date(),
      }

      console.log("Creando nueva tarea:", nuevaTarea)
      const id = await guardarTarea(nuevaTarea)

      // Agregar la tarea al estado local con el ID generado
      const tareaConId: Tarea = { ...nuevaTarea, id }
      setTareas((prev) => [tareaConId, ...prev])

      reset()
      setDialogoAbierto(false)

      toast({
        title: "Tarea creada",
        description: "La tarea se ha agregado exitosamente.",
      })
    } catch (error) {
      console.error("Error al crear tarea:", error)
      toast({
        title: "Error",
        description: "No se pudo crear la tarea.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Función para eliminar tarea
  const eliminarTareaLocal = async (id: string) => {
    if (window.confirm("¿Está seguro que desea eliminar esta tarea? Esta acción no se puede deshacer.")) {
      try {
        console.log("Eliminando tarea:", id)
        await eliminarTarea(id)

        // Actualizar estado local
        setTareas((prev) => prev.filter((tarea) => tarea.id !== id))

        toast({
          title: "Tarea eliminada",
          description: "La tarea se ha eliminado exitosamente.",
        })
      } catch (error) {
        console.error("Error al eliminar tarea:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar la tarea.",
          variant: "destructive",
        })
      }
    }
  }

  // Función para marcar como completada
  const toggleCompletada = async (id: string) => {
    try {
      const tarea = tareas.find((t) => t.id === id)
      if (!tarea) return

      const nuevoEstado = !tarea.completada
      console.log("Cambiando estado de tarea:", id, "a", nuevoEstado)

      // Actualizar en Firebase
      await actualizarTarea(id, { completada: nuevoEstado })

      // Actualizar estado local
      setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, completada: nuevoEstado } : t)))

      toast({
        title: nuevoEstado ? "Tarea completada" : "Tarea marcada como pendiente",
        description: nuevoEstado ? "¡Excelente trabajo!" : "La tarea se marcó como pendiente.",
      })
    } catch (error) {
      console.error("Error al actualizar tarea:", error)
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea.",
        variant: "destructive",
      })
    }
  }

  // Función para verificar si una tarea está vencida
  const estaVencida = (fechaLimite: Date, completada: boolean) => {
    if (completada) return false
    return isBefore(startOfDay(fechaLimite), startOfDay(new Date()))
  }

  // Filtrar tareas
  const tareasFiltradas = tareas.filter((tarea) => {
    switch (filtro) {
      case "completadas":
        return tarea.completada
      case "pendientes":
        return !tarea.completada
      default:
        return true
    }
  })

  // Calcular estadísticas
  const tareasCompletadas = tareas.filter((tarea) => tarea.completada).length
  const tareasPendientes = tareas.filter((tarea) => !tarea.completada).length

  // Mostrar pantalla de carga mientras se cargan los datos
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando bitácora de tareas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Bitácora de Tareas</h1>
            <p className="text-muted-foreground mt-1">Gestiona y organiza tus tareas diarias</p>
          </div>

          {/* Estadísticas */}
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                {tareasCompletadas}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">Completadas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{tareasPendientes}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Pendientes</div>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          {/* Filtros */}
          <div className="flex items-center gap-2">
            <Label htmlFor="filtro" className="text-sm font-medium">
              Filtrar:
            </Label>
            <Select value={filtro} onValueChange={(value: any) => setFiltro(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="completadas">Completadas</SelectItem>
                <SelectItem value="pendientes">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botón Nueva Tarea */}
          <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="titulo">
                    Título de la tarea <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="titulo"
                    {...register("titulo")}
                    placeholder="Ingrese el título de la tarea"
                    className="mt-1"
                  />
                  {errors.titulo && <p className="text-red-500 text-sm mt-1">{errors.titulo.message}</p>}
                </div>

                <div>
                  <Label htmlFor="descripcion">
                    Descripción <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="descripcion"
                    {...register("descripcion")}
                    placeholder="Describe la tarea en detalle"
                    className="mt-1 min-h-[80px]"
                  />
                  {errors.descripcion && <p className="text-red-500 text-sm mt-1">{errors.descripcion.message}</p>}
                </div>

                <div>
                  <Label htmlFor="fechaLimite">
                    Fecha límite <span className="text-red-500">*</span>
                  </Label>
                  <Input id="fechaLimite" type="datetime-local" {...register("fechaLimite")} className="mt-1" />
                  {errors.fechaLimite && <p className="text-red-500 text-sm mt-1">{errors.fechaLimite.message}</p>}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogoAbierto(false)}
                    className="w-full sm:w-auto"
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Tarea"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabla de Tareas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Lista de Tareas ({tareasFiltradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Cargando tareas...</p>
              </div>
            ) : tareasFiltradas.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg font-medium">
                  {filtro === "todas"
                    ? "No hay tareas registradas"
                    : filtro === "completadas"
                      ? "No hay tareas completadas"
                      : "No hay tareas pendientes"}
                </p>
                <p className="text-muted-foreground mt-2">
                  {filtro === "todas"
                    ? "Crea tu primera tarea para comenzar"
                    : "Cambia el filtro para ver otras tareas"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Título</TableHead>
                      <TableHead className="hidden sm:table-cell">Descripción</TableHead>
                      <TableHead className="w-[150px]">Fecha Límite</TableHead>
                      <TableHead className="w-[100px]">Estado</TableHead>
                      <TableHead className="w-[120px] text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tareasFiltradas.map((tarea) => (
                      <TableRow key={tarea.id}>
                        <TableCell className="font-medium">
                          <div className={tarea.completada ? "line-through text-muted-foreground" : ""}>
                            {tarea.titulo}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div
                            className={`max-w-xs truncate ${tarea.completada ? "line-through text-muted-foreground" : ""}`}
                          >
                            {tarea.descripcion}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {format(tarea.fechaLimite, "dd/MM/yyyy HH:mm", { locale: es })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tarea.completada ? (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completada
                            </Badge>
                          ) : estaVencida(tarea.fechaLimite, tarea.completada) ? (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Vencida
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant={tarea.completada ? "secondary" : "default"}
                              onClick={() => toggleCompletada(tarea.id!)}
                              className="h-8 w-8 p-0"
                              title={tarea.completada ? "Marcar como pendiente" : "Marcar como completada"}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => eliminarTareaLocal(tarea.id!)}
                              className="h-8 w-8 p-0"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
