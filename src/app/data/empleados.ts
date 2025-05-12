export interface Empleado {
  nombre: string
  cargo: string
  cedula: string
  salarioBase: number
  valorDia: number
  valorHora: number
  horaExtraDiurna: number
  horaNormalNocturna: number
  horaExtraNocturna: number
  horaFeriadaDiurna: number
  horaExtraFeriadaDiurna: number
  horaNocturnaDiurna: number
  horaExtraFeriadaNocturna: number
}

export const empleados: Empleado[] = [
  {
    nombre: "DIANA CAMILA CARABALI ACEVEDO",
    cargo: "AUXILIAR ADMINISTRATIVA",
    cedula: "1144211949",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
  {
    nombre: "GENESIS VELASQUEZ CRIADO",
    cargo: "AUXILIAR OPERATIVA",
    cedula: "1065665108",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
  {
    nombre: "LUISA FERNANDA GARZON AVENDAÑO",
    cargo: "AUXILIAR OPERATIVA",
    cedula: "66964158",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
  {
    nombre: "LUZ VIVIANA CASAS LOZANO",
    cargo: "AUXILIAR OPERATIVA",
    cedula: "38610313",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
  {
    nombre: "JEIMMY YAMILE MOJICA AVILA",
    cargo: "AUXILIAR OPERATIVA",
    cedula: "1073153022",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
  {
    nombre: "BRAYAN ALBERTO OSPINA",
    cargo: "AUXILIAR OPERATIVA",
    cedula: "1108639714",
    salarioBase: 1423000,
    valorDia: 47433,
    valorHora: 5929,
    horaExtraDiurna: 7411,
    horaNormalNocturna: 2075,
    horaExtraNocturna: 9190,
    horaFeriadaDiurna: 10376,
    horaExtraFeriadaDiurna: 11858,
    horaNocturnaDiurna: 12451,
    horaExtraFeriadaNocturna: 13934,
  },
]

export interface RegistroHora {
  id?: string // Hacemos el ID opcional para la creación
  empleadoId: string
  fecha: Date
  horaInicio: string
  horaFin: string
  esFeriado: boolean
  esHoraExtra?: boolean // Indica si es hora extra
  cantidadHorasExtra?: number // Nuevo campo para la cantidad de horas extra
  tipoHoraExtra?: string // Tipo de hora extra (diurna/nocturna)
  tipoRecargo: string
  horasTrabajadas: number
}

export interface ResumenEmpleado {
  id?: string
  empleadoId: string
  periodo: {
    inicio: Date
    fin: Date
  }
  horasNormales: number
  horasExtraDiurnas: number
  horasNormalNocturnas: number
  horasExtraNocturnas: number
  horasFeriadoDiurnas: number
  horasExtraFeriadoDiurnas: number
  horasFeriadoNocturnas: number
  horasExtraFeriadoNocturnas: number
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
  totalValor?: number // Propiedad totalValor como opcional
}

export const tiposRecargo: Record<string, string> = {
  HED: "Hora Extra Diurna",
  HNN: "Hora Normal Nocturna",
  HEN: "Hora Extra Nocturna",
  HFD: "Hora Feriada Diurna",
  HEFD: "Hora Extra Feriada Diurna",
  HFN: "Hora Feriada Nocturna",
  HEFN: "Hora Extra Feriada Nocturna",
  Normal: "Hora Normal",
}

export const obtenerEmpleadoPorNombre = (nombre: string): Empleado | undefined => {
  return empleados.find((emp) => emp.nombre === nombre)
}

export const obtenerEmpleadoPorId = (id: string): Empleado | undefined => {
  return empleados.find((emp) => emp.nombre === id)
}
