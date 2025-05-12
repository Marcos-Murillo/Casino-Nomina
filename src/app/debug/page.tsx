"use client"

import { useState, useEffect } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../firebase/config"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Loader2 } from "lucide-react"

export default function DebugPage() {
  const [collections, setCollections] = useState<string[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>("")
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Colecciones conocidas
  const knownCollections = ["registros_horas", "resumenes_empleados", "configuracion"]

  useEffect(() => {
    setCollections(knownCollections)
  }, [])

  const fetchDocuments = async (collectionName: string) => {
    setIsLoading(true)
    setError(null)
    setDocuments([])

    try {
      console.log(`Obteniendo documentos de la colección: ${collectionName}`)
      const querySnapshot = await getDocs(collection(db, collectionName))

      console.log(`Documentos encontrados: ${querySnapshot.docs.length}`)

      const docs = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          _raw: JSON.stringify(data, null, 2),
        }
      })

      setDocuments(docs)
      setSelectedCollection(collectionName)
    } catch (err) {
      console.error("Error al obtener documentos:", err)
      setError(`Error al obtener documentos: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white p-6">
      <Card className="mx-auto max-w-6xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Depuración de Firestore</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => (
              <Button
                key={collection}
                variant={selectedCollection === collection ? "default" : "outline"}
                onClick={() => fetchDocuments(collection)}
              >
                {collection}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2">Cargando documentos...</span>
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                {documents.length} documento(s) en {selectedCollection}
              </h3>

              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border p-4">
                  <h4 className="font-medium">ID: {doc.id}</h4>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-blue-500">Ver datos completos</summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-gray-100 p-2 text-xs">{doc._raw}</pre>
                  </details>
                </div>
              ))}
            </div>
          ) : selectedCollection ? (
            <div className="rounded-md bg-yellow-50 p-4 text-yellow-700">
              No se encontraron documentos en la colección {selectedCollection}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
