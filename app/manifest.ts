import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KAHFI PHOTOBOOTH',
    short_name: 'KAHFI PHOTO',
    description: 'Cute touchscreen photobooth for Xiaomi Pad 6',
    start_url: '/',
    display: 'fullscreen',
    background_color: '#f8fbff',
    theme_color: '#5d7fff',
    orientation: 'landscape'
  };
}
