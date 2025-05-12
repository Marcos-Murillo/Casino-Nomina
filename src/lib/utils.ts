import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Función simplificada para combinar clases
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}