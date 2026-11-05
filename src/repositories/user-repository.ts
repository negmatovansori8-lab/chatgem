import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { SessionUser } from "@/server/auth/providers";
import { resolveRole } from "@/server/auth/roles";

const scrypt = promisify(scryptCb);
const FILE = "users.json";

type StoredUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  provider: SessionUser["provider"];
  planId: SessionUser["planId"];
  passwordHash: string | null;
  createdAt: string;
};

type Store = { users: StoredUser[] };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toSession(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    provider: user.provider,
    planId: user.planId,
    role: resolveRole(user.email),
    createdAt: user.createdAt,
  };
}

async function load(): Promise<Store> {
  return readJsonFile<Store>(FILE, { users: [] });
}

async function save(store: Store) {
  await writeJsonFile(FILE, store);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

async function passwordMatches(password: string, encoded: string) {
  const [scheme, salt, hash] = encoded.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function blankUser(input: {
  email: string;
  name?: string;
  image?: string | null;
  provider: SessionUser["provider"];
  passwordHash: string | null;
}): StoredUser {
  const email = normalizeEmail(input.email);
  return {
    id: crypto.randomUUID(),
    email,
    name: input.name?.trim() || email.split("@")[0] || "User",
    image: input.image ?? null,
    provider: input.provider,
    planId: "free",
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  };
}

export const userRepository = {
  /** Same email always returns the same account. Google on a second phone reopens it. */
  async upsertOAuth(input: {
    email: string;
    name?: string;
    image?: string | null;
    provider: SessionUser["provider"];
  }): Promise<SessionUser> {
    const email = normalizeEmail(input.email);
    const store = await load();
    const existing = store.users.find((user) => user.email === email);
    if (existing) {
      existing.name = input.name?.trim() || existing.name;
      if (input.image) existing.image = input.image;
      if (existing.provider === "credentials" || existing.provider === "guest") {
        existing.provider = input.provider;
      }
      await save(store);
      return toSession(existing);
    }
    const created = blankUser({ ...input, email, passwordHash: null });
    store.users.push(created);
    await save(store);
    return toSession(created);
  },

  async register(input: { email: string; password: string; name?: string }): Promise<SessionUser> {
    const email = normalizeEmail(input.email);
    const store = await load();
    if (store.users.some((user) => user.email === email)) {
      throw new Error("Ин почта аллакай ҳисоб дорад. Ворид шавед.");
    }
    const created = blankUser({
      email,
      name: input.name,
      image: null,
      provider: "credentials",
      passwordHash: await hashPassword(input.password),
    });
    store.users.push(created);
    await save(store);
    return toSession(created);
  },

  async login(input: { email: string; password: string }): Promise<SessionUser> {
    const email = normalizeEmail(input.email);
    const store = await load();
    const existing = store.users.find((user) => user.email === email);
    if (!existing) {
      throw new Error("Ин почта ҳисоб надорад. Аввал сабти ном кунед.");
    }
    if (!existing.passwordHash) {
      throw new Error("Ин ҳисоб бо Google кушода шудааст. Тугмаи Google-ро пахш кунед.");
    }
    if (!(await passwordMatches(input.password, existing.passwordHash))) {
      throw new Error("Рамз нодуруст аст.");
    }
    return toSession(existing);
  },
};
