export const ENV = {
  appId: process.env.VITE_APP_ID ?? "marketing-engine",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  forgeApiUrl: process.env.FORGE_API_URL ?? "",
  forgeApiKey: process.env.FORGE_API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT ?? "3000", 10),
};
