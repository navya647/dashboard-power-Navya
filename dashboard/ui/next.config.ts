import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // allow loading the dev server from other devices on the LAN (phone/tablet testing)
  // (your LAN IP changes between networks; add the new one here if the page sticks on "Loading…")
  allowedDevOrigins: ['192.168.1.17', '192.168.0.65'],
  // static HTML export so the built `out/` folder can be drag-and-dropped straight onto Netlify
  // (Netlify's drag-and-drop has no build step — it can only ever serve pre-built static files).
  output: 'export',
};

export default nextConfig;
