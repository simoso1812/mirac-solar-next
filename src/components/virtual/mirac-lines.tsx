/**
 * Deck accents (El Zulia pitch / teaser): the 3px lime → orange → red bar
 * and the gradient used on accent text.
 */

export const MIRAC_GRADIENT = 'linear-gradient(90deg,#C6F500,#FF9E1B,#FB2150)'

export function MiracBar({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`h-[3px] w-full ${className}`} style={{ background: MIRAC_GRADIENT }} />
}
