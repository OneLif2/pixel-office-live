const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/pixel-office-live'

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}
