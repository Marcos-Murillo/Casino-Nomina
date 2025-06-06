import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getFirestore,
} from "firebase/firestore"
import { db } from "./config"
import type { RegistroHora, ResumenEmpleado } from "../data/empleados"

// Colecciones
const REGISTROS_COLLECTION = "registros_horas"
const RESUMENES_COLLECTION = "resumenes_empleados"
const CONFIGURACION_COLLECTION = "configuracion"
const TAREAS_COLLECTION = "tareas"

// Interfaces para Firebase
export interface RegistroHoraFirebase extends Omit<RegistroHora, "fecha" | "id"> {
  fecha: Timestamp
  id?: string
  esHoraExtra?: boolean
  cantidadHorasExtra?: number
  tipoHoraExtra?: string
}

export interface ResumenEmpleadoFirebase extends Omit<ResumenEmpleado, "periodo" | "id"> {
  periodo: {
    inicio: Timestamp
    fin: Timestamp
  }
  fechaGuardado?: Timestamp
  id?: string
  totalValor?: number
}

// Nueva interfaz para Tareas
export interface Tarea {
  id?: string
  titulo: string
  descripcion: string
  fechaLimite: Date
  completada: boolean
  fechaCreacion: Date
}

export interface TareaFirebase extends Omit<Tarea, "fechaLimite" | "fechaCreacion" | "id"> {
  fechaLimite: Timestamp
  fechaCreacion: Timestamp
  id?: string
}

// Función para limpiar objetos antes de guardarlos en Firebase
// Elimina propiedades undefined y convierte valores a tipos adecuados
function limpiarObjeto(obj: Record<string, any>): Record<string, any> {
  const resultado: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Omitir propiedades undefined
    if (value === undefined) continue

    // Manejar objetos anidados
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      !(value instanceof Timestamp)
    ) {
      resultado[key] = limpiarObjeto(value)
    }
    // Convertir Date a Timestamp
    else if (value instanceof Date) {
      resultado[key] = Timestamp.fromDate(value)
    }
    // Asegurar que los números sean realmente números
    else if (typeof value === "string" && !isNaN(Number(value))) {
      // Solo convertir si parece un número
      if (/^\d+(\.\d+)?$/.test(value)) {
        resultado[key] = Number(value)
      } else {
        resultado[key] = value
      }
    }
    // Mantener otros valores como están
    else {
      resultado[key] = value
    }
  }

  return resultado
}

// Funciones para Registros de Horas
export const guardarRegistroHora = async (registro: RegistroHora): Promise<string> => {
  try {
    console.log("Guardando registro:", JSON.stringify(registro, null, 2))

    // Asegurarse de que la fecha sea un objeto Date válido
    const fechaRegistro = registro.fecha instanceof Date ? registro.fecha : new Date(registro.fecha)

    // Crear una copia del registro sin el ID (si existe)
    const { id, ...registroSinId } = registro as any

    // Crear un objeto base con valores por defecto para campos opcionales
    const registroBase: Record<string, any> = {
      empleadoId: registroSinId.empleadoId || "",
      fecha: Timestamp.fromDate(fechaRegistro),
      horaInicio: registroSinId.horaInicio || "",
      horaFin: registroSinId.horaFin || "",
      esFeriado: registroSinId.esFeriado || false,
      tipoRecargo: registroSinId.tipoRecargo || "Normal",
      horasTrabajadas: Number(registroSinId.horasTrabajadas) || 0,
      esHoraExtra: registroSinId.esHoraExtra || false,
    }

    // Añadir campos opcionales solo si tienen valores
    if (registroSinId.esHoraExtra) {
      // Si es hora extra, asegurarse de que cantidadHorasExtra sea un número
      if (registroSinId.cantidadHorasExtra !== undefined && registroSinId.cantidadHorasExtra !== null) {
        registroBase.cantidadHorasExtra = Number(registroSinId.cantidadHorasExtra)
      } else {
        registroBase.cantidadHorasExtra = 0
      }

      // Si es hora extra, tipoHoraExtra debe tener un valor
      registroBase.tipoHoraExtra = registroSinId.tipoHoraExtra || "diurna"
    }

    // Limpiar el objeto para eliminar valores undefined y convertir tipos
    const registroLimpio = limpiarObjeto(registroBase)
    console.log("Registro limpio a guardar:", JSON.stringify(registroLimpio, null, 2))

    // Guardar en Firestore
    const docRef = await addDoc(collection(db, REGISTROS_COLLECTION), registroLimpio)
    console.log("Documento guardado con ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error al guardar registro:", error)
    if (error instanceof Error) {
      throw new Error(`Error al guardar registro: ${error.message}`)
    }
    throw error
  }
}

export const obtenerRegistrosHoras = async (): Promise<RegistroHora[]> => {
  try {
    const querySnapshot = await getDocs(query(collection(db, REGISTROS_COLLECTION), orderBy("fecha", "desc")))

    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as RegistroHoraFirebase
      return {
        ...data,
        id: doc.id,
        fecha: data.fecha.toDate(),
        cantidadHorasExtra: data.cantidadHorasExtra !== undefined ? Number(data.cantidadHorasExtra) : undefined,
      }
    })
  } catch (error) {
    console.error("Error al obtener registros:", error)
    return []
  }
}

export const obtenerRegistrosPorEmpleado = async (empleadoId: string): Promise<RegistroHora[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, REGISTROS_COLLECTION), where("empleadoId", "==", empleadoId), orderBy("fecha", "desc")),
    )

    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as RegistroHoraFirebase
      return {
        ...data,
        id: doc.id,
        fecha: data.fecha.toDate(),
        cantidadHorasExtra: data.cantidadHorasExtra !== undefined ? Number(data.cantidadHorasExtra) : undefined,
      }
    })
  } catch (error) {
    console.error("Error al obtener registros por empleado:", error)
    return []
  }
}

export const obtenerRegistrosPorPeriodo = async (fechaInicio: Date, fechaFin: Date): Promise<RegistroHora[]> => {
  try {
    // Obtenemos todos los registros y filtramos por fecha
    // (Firestore no permite consultas de rango en campos diferentes)
    const querySnapshot = await getDocs(collection(db, REGISTROS_COLLECTION))

    return querySnapshot.docs
      .map((doc) => {
        const data = doc.data() as RegistroHoraFirebase
        return {
          ...data,
          id: doc.id,
          fecha: data.fecha.toDate(),
          cantidadHorasExtra: data.cantidadHorasExtra !== undefined ? Number(data.cantidadHorasExtra) : undefined,
        }
      })
      .filter((registro) => registro.fecha >= fechaInicio && registro.fecha <= fechaFin)
  } catch (error) {
    console.error("Error al obtener registros por periodo:", error)
    return []
  }
}

// Añade esta función para eliminar registros de horas
export const eliminarRegistroHora = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, REGISTROS_COLLECTION, id))
  } catch (error) {
    console.error("Error al eliminar registro:", error)
    throw error
  }
}

// Funciones para Resúmenes de Empleados
export const guardarResumenEmpleado = async (resumen: ResumenEmpleado & { fechaGuardado?: Date }): Promise<string> => {
  try {
    console.log("Guardando resumen:", JSON.stringify(resumen, null, 2))

    // Crear una copia del resumen sin el ID (si existe)
    const { id, ...resumenSinId } = resumen as any

    // Asegurarse de que todos los campos numéricos sean números
    const resumenBase = {
      empleadoId: resumenSinId.empleadoId || "",
      periodo: {
        inicio: Timestamp.fromDate(resumenSinId.periodo.inicio),
        fin: Timestamp.fromDate(resumenSinId.periodo.fin),
      },
      horasNormales: Number(resumenSinId.horasNormales) || 0,
      horasExtraDiurnas: Number(resumenSinId.horasExtraDiurnas) || 0,
      horasNormalNocturnas: Number(resumenSinId.horasNormalNocturnas) || 0,
      horasExtraNocturnas: Number(resumenSinId.horasExtraNocturnas) || 0,
      horasFeriadoDiurnas: Number(resumenSinId.horasFeriadoDiurnas) || 0,
      horasExtraFeriadoDiurnas: Number(resumenSinId.horasExtraFeriadoDiurnas) || 0,
      horasFeriadoNocturnas: Number(resumenSinId.horasFeriadoNocturnas) || 0,
      horasExtraFeriadoNocturnas: Number(resumenSinId.horasExtraFeriadoNocturnas) || 0,
      auxilioTransporte: Number(resumenSinId.auxilioTransporte) || 0,
      auxilioAlimentacion: Number(resumenSinId.auxilioAlimentacion) || 0,
      diasIncapacidad: Number(resumenSinId.diasIncapacidad) || 0,
      beneficioProductividad: Number(resumenSinId.beneficioProductividad) || 0,
      deducciones: {
        seguridadSocial: Number(resumenSinId.deducciones?.seguridadSocial) || 0,
        polizaSura: Number(resumenSinId.deducciones?.polizaSura) || 0,
        adelantoNomina: Number(resumenSinId.deducciones?.adelantoNomina) || 0,
        otrosDescuentos: Number(resumenSinId.deducciones?.otrosDescuentos) || 0,
      },
      totalValor: Number(resumenSinId.totalValor) || 0,
      fechaGuardado: resumenSinId.fechaGuardado ? Timestamp.fromDate(resumenSinId.fechaGuardado) : Timestamp.now(),
    }

    // Limpiar el objeto para eliminar valores undefined y convertir tipos
    const resumenLimpio = limpiarObjeto(resumenBase)
    console.log("Resumen limpio a guardar:", JSON.stringify(resumenLimpio, null, 2))

    // Generar un ID único para el documento
    const docId = id || `resumen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Usar setDoc en lugar de addDoc para tener más control
    await setDoc(doc(db, RESUMENES_COLLECTION, docId), resumenLimpio)

    console.log("Resumen guardado con ID:", docId)
    return docId
  } catch (error) {
    console.error("Error al guardar resumen:", error)
    if (error instanceof Error) {
      throw new Error(`Error al guardar resumen: ${error.message}`)
    }
    throw error
  }
}

export const obtenerResumenesEmpleados = async (): Promise<(ResumenEmpleado & { fechaGuardado: Date })[]> => {
  try {
    console.log("Obteniendo resúmenes de empleados desde Firebase...")
    const querySnapshot = await getDocs(collection(db, RESUMENES_COLLECTION))

    console.log("Documentos encontrados:", querySnapshot.docs.length)

    const resumenes = querySnapshot.docs
      .map((doc) => {
        const data = doc.data()
        console.log("Datos del documento:", doc.id, data)

        // Verificar si los campos necesarios existen
        if (!data.periodo || !data.periodo.inicio || !data.periodo.fin) {
          console.warn("Documento con estructura incorrecta:", doc.id)
          return null
        }

        // Convertir Timestamp a Date
        const periodoInicio =
          data.periodo.inicio instanceof Timestamp ? data.periodo.inicio.toDate() : new Date(data.periodo.inicio)

        const periodoFin =
          data.periodo.fin instanceof Timestamp ? data.periodo.fin.toDate() : new Date(data.periodo.fin)

        const fechaGuardado =
          data.fechaGuardado instanceof Timestamp
            ? data.fechaGuardado.toDate()
            : data.fechaGuardado
              ? new Date(data.fechaGuardado)
              : new Date()

        return {
          ...data,
          id: doc.id,
          periodo: {
            inicio: periodoInicio,
            fin: periodoFin,
          },
          fechaGuardado: fechaGuardado,
          totalValor: Number(data.totalValor) || 0,
          horasNormales: Number(data.horasNormales) || 0,
          horasExtraDiurnas: Number(data.horasExtraDiurnas) || 0,
          horasNormalNocturnas: Number(data.horasNormalNocturnas) || 0,
          horasExtraNocturnas: Number(data.horasExtraNocturnas) || 0,
          horasFeriadoDiurnas: Number(data.horasFeriadoDiurnas) || 0,
          horasExtraFeriadoDiurnas: Number(data.horasExtraFeriadoDiurnas) || 0,
          horasFeriadoNocturnas: Number(data.horasFeriadoNocturnas) || 0,
          horasExtraFeriadoNocturnas: Number(data.horasExtraFeriadoNocturnas) || 0,
          auxilioTransporte: Number(data.auxilioTransporte) || 0,
          auxilioAlimentacion: Number(data.auxilioAlimentacion) || 0,
          diasIncapacidad: Number(data.diasIncapacidad) || 0,
          beneficioProductividad: Number(data.beneficioProductividad) || 0,
          deducciones: {
            seguridadSocial: Number(data.deducciones?.seguridadSocial) || 0,
            polizaSura: Number(data.deducciones?.polizaSura) || 0,
            adelantoNomina: Number(data.deducciones?.adelantoNomina) || 0,
            otrosDescuentos: Number(data.deducciones?.otrosDescuentos) || 0,
          },
        }
      })
      .filter(Boolean) as (ResumenEmpleado & { fechaGuardado: Date })[]

    console.log("Resúmenes procesados:", resumenes.length)
    return resumenes
  } catch (error) {
    console.error("Error al obtener resúmenes:", error)
    return []
  }
}

// Añadir esta nueva función después de obtenerResumenesEmpleados:

export const obtenerResumenesEmpleadosDirecto = async (): Promise<(ResumenEmpleado & { fechaGuardado: Date })[]> => {
  try {
    console.log("Obteniendo resúmenes directamente de la colección...")

    // Obtener referencia a la colección
    const resumenesRef = collection(db, RESUMENES_COLLECTION)
    console.log("Referencia a la colección obtenida")

    // Obtener todos los documentos sin filtros
    const querySnapshot = await getDocs(resumenesRef)
    console.log("Documentos encontrados:", querySnapshot.docs.length)

    if (querySnapshot.empty) {
      console.log("No se encontraron documentos en la colección")
      return []
    }

    // Procesar cada documento
    const resumenes = querySnapshot.docs
      .map((doc) => {
        try {
          const data = doc.data()
          console.log(`Procesando documento ${doc.id}:`, data)

          // Verificar si el documento tiene la estructura básica necesaria
          if (!data) {
            console.warn(`Documento ${doc.id} está vacío`)
            return null
          }

          // Crear un objeto con valores predeterminados para evitar errores
          const resumen: ResumenEmpleado & { fechaGuardado: Date } = {
            id: doc.id,
            empleadoId: data.empleadoId || "Desconocido",
            periodo: {
              inicio: data.periodo?.inicio instanceof Timestamp ? data.periodo.inicio.toDate() : new Date(),
              fin: data.periodo?.fin instanceof Timestamp ? data.periodo.fin.toDate() : new Date(),
            },
            horasNormales: Number(data.horasNormales) || 0,
            horasExtraDiurnas: Number(data.horasExtraDiurnas) || 0,
            horasNormalNocturnas: Number(data.horasNormalNocturnas) || 0,
            horasExtraNocturnas: Number(data.horasExtraNocturnas) || 0,
            horasFeriadoDiurnas: Number(data.horasFeriadoDiurnas) || 0,
            horasExtraFeriadoDiurnas: Number(data.horasExtraFeriadoDiurnas) || 0,
            horasFeriadoNocturnas: Number(data.horasFeriadoNocturnas) || 0,
            horasExtraFeriadoNocturnas: Number(data.horasExtraFeriadoNocturnas) || 0,
            auxilioTransporte: Number(data.auxilioTransporte) || 0,
            auxilioAlimentacion: Number(data.auxilioAlimentacion) || 0,
            diasIncapacidad: Number(data.diasIncapacidad) || 0,
            beneficioProductividad: Number(data.beneficioProductividad) || 0,
            deducciones: {
              seguridadSocial: Number(data.deducciones?.seguridadSocial) || 0,
              polizaSura: Number(data.deducciones?.polizaSura) || 0,
              adelantoNomina: Number(data.deducciones?.adelantoNomina) || 0,
              otrosDescuentos: Number(data.deducciones?.otrosDescuentos) || 0,
            },
            totalValor: Number(data.totalValor) || 0,
            fechaGuardado: data.fechaGuardado instanceof Timestamp ? data.fechaGuardado.toDate() : new Date(),
          }

          console.log(`Documento ${doc.id} procesado correctamente`)
          return resumen
        } catch (err) {
          console.error(`Error procesando documento ${doc.id}:`, err)
          return null
        }
      })
      .filter(Boolean) as (ResumenEmpleado & { fechaGuardado: Date })[]

    console.log("Total de resúmenes procesados correctamente:", resumenes.length)
    return resumenes
  } catch (error) {
    console.error("Error al obtener resúmenes directamente:", error)
    throw error
  }
}

export const obtenerResumenPorId = async (id: string): Promise<ResumenEmpleado | null> => {
  try {
    const docRef = doc(db, RESUMENES_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const data = docSnap.data() as ResumenEmpleadoFirebase
    return {
      ...data,
      id: docSnap.id,
      periodo: {
        inicio: data.periodo.inicio.toDate(),
        fin: data.periodo.fin.toDate(),
      },
      totalValor: Number(data.totalValor) || 0,
      horasNormales: Number(data.horasNormales) || 0,
      horasExtraDiurnas: Number(data.horasExtraDiurnas) || 0,
      horasNormalNocturnas: Number(data.horasNormalNocturnas) || 0,
      horasExtraNocturnas: Number(data.horasExtraNocturnas) || 0,
      horasFeriadoDiurnas: Number(data.horasFeriadoDiurnas) || 0,
      horasExtraFeriadoDiurnas: Number(data.horasExtraFeriadoDiurnas) || 0,
      horasFeriadoNocturnas: Number(data.horasFeriadoNocturnas) || 0,
      horasExtraFeriadoNocturnas: Number(data.horasExtraFeriadoNocturnas) || 0,
      auxilioTransporte: Number(data.auxilioTransporte) || 0,
      auxilioAlimentacion: Number(data.auxilioAlimentacion) || 0,
      diasIncapacidad: Number(data.diasIncapacidad) || 0,
      beneficioProductividad: Number(data.beneficioProductividad) || 0,
      deducciones: {
        seguridadSocial: Number(data.deducciones?.seguridadSocial) || 0,
        polizaSura: Number(data.deducciones?.polizaSura) || 0,
        adelantoNomina: Number(data.deducciones?.adelantoNomina) || 0,
        otrosDescuentos: Number(data.deducciones?.otrosDescuentos) || 0,
      },
    }
  } catch (error) {
    console.error("Error al obtener resumen por ID:", error)
    return null
  }
}

export const eliminarResumenEmpleado = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, RESUMENES_COLLECTION, id))
  } catch (error) {
    console.error("Error al eliminar resumen:", error)
    throw error
  }
}

// Añadir esta función al archivo services.ts

export async function actualizarResumenEmpleado(resumen: any) {
  try {
    const { id, ...resumenData } = resumen

    if (!id) {
      throw new Error("El resumen no tiene un ID válido")
    }

    const db = getFirestore()
    const resumenRef = doc(db, "resumenes_empleados", id)

    await updateDoc(resumenRef, resumenData)

    return id
  } catch (error) {
    console.error("Error al actualizar resumen:", error)
    throw error
  }
}

// ==================== FUNCIONES PARA TAREAS ====================

// Función para guardar una nueva tarea
export const guardarTarea = async (tarea: Omit<Tarea, "id">): Promise<string> => {
  try {
    console.log("Guardando tarea:", JSON.stringify(tarea, null, 2))

    // Crear objeto para Firebase con Timestamps
    const tareaFirebase: Omit<TareaFirebase, "id"> = {
      titulo: tarea.titulo,
      descripcion: tarea.descripcion,
      fechaLimite: Timestamp.fromDate(tarea.fechaLimite),
      completada: tarea.completada,
      fechaCreacion: Timestamp.fromDate(tarea.fechaCreacion),
    }

    // Limpiar el objeto
    const tareaLimpia = limpiarObjeto(tareaFirebase)
    console.log("Tarea limpia a guardar:", JSON.stringify(tareaLimpia, null, 2))

    // Guardar en Firestore
    const docRef = await addDoc(collection(db, TAREAS_COLLECTION), tareaLimpia)
    console.log("Tarea guardada con ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error al guardar tarea:", error)
    if (error instanceof Error) {
      throw new Error(`Error al guardar tarea: ${error.message}`)
    }
    throw error
  }
}

// Función para obtener todas las tareas
export const obtenerTareas = async (): Promise<Tarea[]> => {
  try {
    console.log("Obteniendo tareas desde Firebase...")
    const querySnapshot = await getDocs(query(collection(db, TAREAS_COLLECTION), orderBy("fechaCreacion", "desc")))

    console.log("Tareas encontradas:", querySnapshot.docs.length)

    const tareas = querySnapshot.docs.map((doc) => {
      const data = doc.data() as TareaFirebase
      return {
        id: doc.id,
        titulo: data.titulo,
        descripcion: data.descripcion,
        fechaLimite: data.fechaLimite.toDate(),
        completada: data.completada,
        fechaCreacion: data.fechaCreacion.toDate(),
      } as Tarea
    })

    console.log("Tareas procesadas:", tareas.length)
    return tareas
  } catch (error) {
    console.error("Error al obtener tareas:", error)
    return []
  }
}

// Función para actualizar una tarea
export const actualizarTarea = async (id: string, actualizaciones: Partial<Omit<Tarea, "id">>): Promise<void> => {
  try {
    console.log("Actualizando tarea:", id, actualizaciones)

    // Convertir fechas a Timestamps si existen
    const actualizacionesFirebase: any = { ...actualizaciones }

    if (actualizaciones.fechaLimite) {
      actualizacionesFirebase.fechaLimite = Timestamp.fromDate(actualizaciones.fechaLimite)
    }

    if (actualizaciones.fechaCreacion) {
      actualizacionesFirebase.fechaCreacion = Timestamp.fromDate(actualizaciones.fechaCreacion)
    }

    // Limpiar el objeto
    const actualizacionesLimpias = limpiarObjeto(actualizacionesFirebase)

    // Actualizar en Firestore
    const tareaRef = doc(db, TAREAS_COLLECTION, id)
    await updateDoc(tareaRef, actualizacionesLimpias)

    console.log("Tarea actualizada exitosamente")
  } catch (error) {
    console.error("Error al actualizar tarea:", error)
    if (error instanceof Error) {
      throw new Error(`Error al actualizar tarea: ${error.message}`)
    }
    throw error
  }
}

// Función para eliminar una tarea
export const eliminarTarea = async (id: string): Promise<void> => {
  try {
    console.log("Eliminando tarea:", id)
    await deleteDoc(doc(db, TAREAS_COLLECTION, id))
    console.log("Tarea eliminada exitosamente")
  } catch (error) {
    console.error("Error al eliminar tarea:", error)
    if (error instanceof Error) {
      throw new Error(`Error al eliminar tarea: ${error.message}`)
    }
    throw error
  }
}

// Función para obtener una tarea por ID
export const obtenerTareaPorId = async (id: string): Promise<Tarea | null> => {
  try {
    const docRef = doc(db, TAREAS_COLLECTION, id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    const data = docSnap.data() as TareaFirebase
    return {
      id: docSnap.id,
      titulo: data.titulo,
      descripcion: data.descripcion,
      fechaLimite: data.fechaLimite.toDate(),
      completada: data.completada,
      fechaCreacion: data.fechaCreacion.toDate(),
    }
  } catch (error) {
    console.error("Error al obtener tarea por ID:", error)
    return null
  }
}

// Funciones para Configuración
export const guardarConfiguracion = async (key: string, value: any): Promise<void> => {
  try {
    // Limpiar el valor antes de guardarlo
    const valorLimpio = limpiarObjeto({ value }).value

    // Usar un ID predecible para la configuración
    const docId = `config_${key}_${Date.now()}`

    await setDoc(doc(db, CONFIGURACION_COLLECTION, docId), {
      key,
      value: valorLimpio,
      timestamp: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error al guardar configuración:", error)
    throw error
  }
}

export const obtenerConfiguracion = async (key: string): Promise<any> => {
  try {
    const q = query(collection(db, CONFIGURACION_COLLECTION), where("key", "==", key))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) return null

    // Ordenamos por timestamp para obtener el más reciente
    const docs = querySnapshot.docs.sort((a, b) => {
      const timestampA = a.data().timestamp.toMillis()
      const timestampB = b.data().timestamp.toMillis()
      return timestampB - timestampA
    })

    return docs[0].data().value
  } catch (error) {
    console.error("Error al obtener configuración:", error)
    return null
  }
}
