import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/mysql2";
import { users, organizations } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const ADMIN_EMAIL = "admin@cacarejar.com.br";
const ADMIN_PASSWORD = "Cacarejar2024@";
const ADMIN_NAME = "Admin Cacarejar";
const ADMIN_COMPANY = "Cacarejar";

async function seed() {
  const db = drizzle(process.env.DATABASE_URL!);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Admin já existe: ${ADMIN_EMAIL}`);
    process.exit(0);
  }

  // Create admin org
  const orgResult = await db.insert(organizations).values({
    name: ADMIN_COMPANY,
    slug: "cacarejar-admin",
    ownerId: 0, // will update after user creation
    plan: "pro",
    isActive: true,
  });
  const orgId = (orgResult as any).insertId as number;

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const userResult = await db.insert(users).values({
    openId: `superadmin-${nanoid()}`,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: hash,
    loginMethod: "password",
    role: "superadmin",
    organizationId: orgId,
    lastSignedIn: new Date(),
  });
  const userId = (userResult as any).insertId as number;

  // Update org ownerId
  await db.update(organizations).set({ ownerId: userId }).where(eq(organizations.id, orgId));

  console.log(`[Seed] Superadmin criado: ${ADMIN_EMAIL}`);
  console.log(`[Seed] Senha: ${ADMIN_PASSWORD}`);
  console.log(`[Seed] Org ID: ${orgId}, User ID: ${userId}`);
  process.exit(0);
}

seed().catch(err => {
  console.error("[Seed] Erro:", err);
  process.exit(1);
});
