import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

function getBase(): string {
  if (process.env.BASE !== undefined) return process.env.BASE;
  const repo = (process.env.GITHUB_REPOSITORY ?? "").toLowerCase();
  const [owner, name] = repo.split("/");
  if (!name) return "/";
  if (name === `${owner}.github.io`) return "/";
  return `/${name}/`;
}

export default defineConfig({
  site: process.env.SITE_URL ?? "https://nepalranks.com",
  base: getBase(),
  trailingSlash: "always",
  output: "static",
  build: { format: "directory" },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/admin/"),
    }),
    icon(),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        { find: "@components", replacement: "/src/components" },
        { find: "@layouts", replacement: "/src/layouts" },
        { find: "@utils", replacement: "/src/utils" },
        { find: "@lib", replacement: "/src/lib" },
        { find: "@styles", replacement: "/src/styles" },
      ],
    },
  },
});
