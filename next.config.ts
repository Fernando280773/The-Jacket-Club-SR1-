import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Menu photos uploaded in admin live in Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "quuengvoweqzaxiuowkl.supabase.co", pathname: "/storage/v1/object/public/menu-photos/**" }],
  },
};

export default nextConfig;
