/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Kamera (getUserMedia) butuh secure context + izin eksplisit di header.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=*, microphone=*' },
          { key: 'X-Content-Type-Options', value: 'nosniff' }
        ]
      }
    ];
  }
};
export default nextConfig;
