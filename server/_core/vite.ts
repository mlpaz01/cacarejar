import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Dev: serve landing.html at root
  app.get("/", (req, res, next) => {
    const landingPath = path.resolve(
      import.meta.dirname,
      "../..",
      "client",
      "public",
      "landing.html"
    );
    if (fs.existsSync(landingPath)) {
      res.sendFile(landingPath);
    } else {
      next();
    }
  });

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Páginas estáticas — ANTES do static middleware
  const staticPages: Record<string, string> = {
    "/":        "landing.html",
    "/precos":  "precos.html",
    "/empresa": "empresa.html",
    "/termos": "termos.html",
    "/privacidade": "privacidade.html",
    "/ferramentas": "ferramentas.html",
    "/ferramentas/engajamento": "ferramentas-engajamento.html",
    "/ferramentas/gerador-de-legenda": "ferramentas-legenda.html",
    "/ferramentas/analisador-de-bio": "ferramentas-bio.html",
  };
  for (const [route, file] of Object.entries(staticPages)) {
    app.get(route, (_req, res) => {
      res.sendFile(path.resolve(distPath, file));
    });
  }

  // Serve static assets (CSS, images, JS bundles)
  app.use(express.static(distPath));

  // React SPA para /app, /admin, /login, /register e tudo mais
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
