/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained server bundle in .next/standalone
  // so the production Docker image only needs node + the standalone dir.
  output: 'standalone',
};

module.exports = nextConfig;
