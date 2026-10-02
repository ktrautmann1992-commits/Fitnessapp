import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace-Pakete liegen als TypeScript-Quellcode vor und werden von Next mitkompiliert.
  transpilePackages: ['@fitnessapp/core', '@fitnessapp/db', '@fitnessapp/ui'],
  poweredByHeader: false,
};

export default nextConfig;
