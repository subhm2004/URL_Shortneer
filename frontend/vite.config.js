import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Port 5050, not 5000: macOS binds 5000 to the AirPlay Receiver
      // (ControlCenter), which silently swallows the requests.
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
      },
    },
  },
});
