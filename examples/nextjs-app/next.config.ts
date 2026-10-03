import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
    // Lets the dev server answer http://127.0.0.1:3000, which the README uses
    // as a second, "foreign" origin for the origin-check demo.
    allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
