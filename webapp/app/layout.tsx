import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KAHFI PHOTOBOOTH',
  description: 'Cute touchscreen photobooth for Xiaomi Pad 6'
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
