/** @type {import('next').NextConfig} */
const nextConfig = {
  // Убираем assetPrefix - статические файлы должны загружаться с того же домена
  // где размещен фронтенд (unaa-tracking.vercel.app)

  // Если нужно, можно использовать условную логику:
  // assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',

  // Настройки для изображений
  images: {
    unoptimized: true,
  },

  // Дополнительные настройки безопасности
  experimental: {
    esmExternals: false,
  },
};

export default nextConfig;
