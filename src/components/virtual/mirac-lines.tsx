/**
 * Deck accents (El Zulia pitch / teaser): the 3px lime → orange → red bar
 * and the gradient used on accent text.
 */

export const MIRAC_GRADIENT = 'linear-gradient(90deg,#C6F500,#FF9E1B,#FB2150)'

export function MiracBar({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`h-[3px] w-full ${className}`} style={{ background: MIRAC_GRADIENT }} />
}

/** Full-bleed photo band, El Zulia deck style (grayscale photo + dark overlay). */
export function PhotoBand({ src, eyebrow, title }: { src: string; eyebrow: string; title: string }) {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#0D0D0D]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[position:55%_55%] md:bg-[position:center_58%] grayscale"
        style={{ backgroundImage: `url(${src})` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg,rgba(13,13,13,.5),rgba(13,13,13,.92))' }}
      />
      <div className="relative mx-auto flex min-h-[260px] max-w-6xl flex-col justify-end px-4 py-10 sm:px-6 md:min-h-[340px]">
        <p className="mirac-ey text-[10px] sm:text-[11px]">{eyebrow}</p>
        <p className="mt-3 max-w-3xl font-['DM_Sans',Arial,sans-serif] text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl">
          {title}
        </p>
      </div>
    </div>
  )
}
