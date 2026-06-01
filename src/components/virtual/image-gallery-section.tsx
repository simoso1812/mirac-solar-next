'use client'

import Image from 'next/image'
import type { ProposalImage } from '@/lib/types'

interface ImageGallerySectionProps {
  imagenes: ProposalImage[]
}

export function ImageGallerySection({ imagenes }: ImageGallerySectionProps) {
  if (!imagenes || imagenes.length === 0) return null

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#BFFF00]" />
        Imágenes del Proyecto
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {imagenes.map((img) => (
          <figure
            key={img.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
          >
            <div className="relative h-56 w-full">
              <Image
                src={img.data}
                alt={img.caption || 'Imagen del proyecto'}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            </div>
            {img.caption.trim() && (
              <figcaption className="px-4 py-3 text-sm text-[#D1D5DB]">
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
