import type { MetadataRoute } from 'next'

/** Manifiesto web: icono y nombre al instalar Mentax en la pantalla de inicio. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mentax · Reflexión personal',
    short_name: 'Mentax',
    description: 'Un espacio para entenderte, crecer y avanzar.',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b6fa4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
