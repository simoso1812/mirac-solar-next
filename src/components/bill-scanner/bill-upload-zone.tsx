'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Camera, X, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BillUploadZoneProps {
  onFilesSelected: (files: File[]) => void
  maxFiles?: number
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return <FileText className="size-4 text-red-500" />
  if (type.includes('wordprocessingml')) return <FileText className="size-4 text-blue-600" />
  if (type.includes('spreadsheetml')) return <FileSpreadsheet className="size-4 text-green-600" />
  return <ImageIcon className="size-4 text-blue-500" />
}

export function BillUploadZone({ onFilesSelected, maxFiles = 10 }: BillUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles).filter((f) => {
      const validType = [
        'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].includes(f.type)
      const validSize = f.size <= 10 * 1024 * 1024
      return validType && validSize
    })

    setSelectedFiles((prev) => {
      const updated = [...prev, ...fileArray].slice(0, maxFiles)
      return updated
    })
  }, [maxFiles])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }, [addFiles])

  const handleSubmit = useCallback(() => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles)
    }
  }, [selectedFiles, onFilesSelected])

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-mirac-red bg-mirac-red/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-accent/50'
        }`}
      >
        <Upload className={`mb-3 size-10 ${dragOver ? 'text-mirac-red' : 'text-muted-foreground'}`} />
        <p className="mb-1 text-sm font-medium">
          Arrastra tu factura de energía aquí
        </p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP, PDF, Word o Excel, máximo 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          aria-label="Seleccionar archivo de factura"
          accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {/* Camera button for mobile */}
      <div className="flex gap-2 sm:hidden">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.capture = 'environment'
            input.onchange = () => {
              if (input.files) addFiles(input.files)
            }
            input.click()
          }}
        >
          <Camera className="mr-2 size-4" />
          Tomar Foto
        </Button>
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {selectedFiles.length} archivo{selectedFiles.length > 1 ? 's' : ''} seleccionado{selectedFiles.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {selectedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                {getFileIcon(file.type)}
                <span className="flex-1 truncate text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  className="rounded p-0.5 hover:bg-destructive/10"
                >
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-mirac-red hover:bg-mirac-red-dark"
          >
            Escanear {selectedFiles.length > 1 ? `${selectedFiles.length} Facturas` : 'Factura'}
          </Button>
        </div>
      )}
    </div>
  )
}
