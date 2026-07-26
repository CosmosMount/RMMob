/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = (process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "").replace(
  /\/$/,
  ""
);

const nextConfig = {
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  ...(isStatic
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        ...(basePath
          ? {
              basePath,
              assetPrefix: basePath,
            }
          : {}),
      }
    : {}),
};

module.exports = nextConfig;
