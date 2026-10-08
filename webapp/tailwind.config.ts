import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {
    fontFamily: { sans: ['var(--font-poppins)', 'Arial', 'sans-serif'] },
    boxShadow: { soft: '0 18px 50px rgba(67, 80, 150, .12)' }
  }},
  plugins: []
};
export default config;
