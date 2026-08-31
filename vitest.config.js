import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    include: ["component-test/**/*.test.jsx"],
    setupFiles: ["./component-test/setup.js"],
    clearMocks: true,
  },
});
