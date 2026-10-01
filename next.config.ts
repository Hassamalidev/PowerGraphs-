import type { NextConfig } from "next";

// Empty now; later e.g. "/powergraphs" when the app lives inside PowerBanks.com.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
};

export default nextConfig;
