'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { UseFormReturn } from 'react-hook-form'
import type { AdvancedFormValues } from '@/lib/schemas'
import { compressImage, dataUrlByteSize } from '@/lib/images'
import type { ProposalImage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'

interface ImagesSectionProps {
  form: UseFormReturn<AdvancedFormValues>
}

export function ImagesSection({ form }: ImagesSectionProps) {
  const { watch, setValue } = form
  const imagenes = watch('imagenes')
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setImageError(null)
    setImageLoading(true)
    try {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
      const newImages: ProposalImage[] = await Promise.all(
        imageFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          data: await compressImage(file),
          caption: '',
        }))
      )
      const combined = [...(imagenes ?? []), ...newImages]
      const totalBytes = combined.reduce((s, img) => s + dataUrlByteSize(img.data), 0)
      if (totalBytes > 4_000_000) {
        setImageError('Las imágenes ocupan mucho espacio; considera quitar algunas para evitar errores al guardar.')
      }
      setValue('imagenes', combined, { shouldDirty: true })
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Error al procesar las imágenes')
    } finally {
      setImageLoading(false)
    }
  }

  const removeImage = (id: string) => {
    setValue('imagenes', (imagenes ?? []).filter((img) => img.id !== id), { shouldDirty: true })
  }

  const updateImageCaption = (id: string, caption: string) => {
    setValue(
      'imagenes',
      (imagenes ?? []).map((img) => (img.id === id ? { ...img, caption } : img)),
      { shouldDirty: true },
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold">Imágenes del Proyecto</Label>
        <p className="text-sm text-muted-foreground">
          Adjunta fotos o renders. Se comprimen automáticamente y aparecen en la cotización virtual y el PDF.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'cursor-pointer',
            imageLoading && 'pointer-events-none opacity-50',
          )}
        >
          {imageLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 size-4" />
          )}
          {imageLoading ? 'Procesando...' : 'Agregar imágenes'}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={imageLoading}
            onChange={(e) => {
              handleAddImages(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        {(imagenes?.length ?? 0) > 0 && (
          <span className="text-sm text-muted-foreground">
            {imagenes.length} {imagenes.length === 1 ? 'imagen' : 'imágenes'}
          </span>
        )}
      </div>

      {imageError && <p className="text-xs text-destructive">{imageError}</p>}

      {(imagenes?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {imagenes.map((img) => (
            <div key={img.id} className="space-y-2 rounded-lg border p-2">
              <div className="relative h-32 w-full">
                <Image
                  src={img.data}
                  alt={img.caption || 'Imagen del proyecto'}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="rounded object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute right-1 top-1 size-6"
                  onClick={() => removeImage(img.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
              <Input
                placeholder="Descripción (opcional)"
                value={img.caption}
                onChange={(e) => updateImageCaption(img.id, e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
