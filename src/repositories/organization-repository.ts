import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { OrganizationMemberRecord, OrganizationRecord } from "@/types/business";

type Store = {
  organizations: OrganizationRecord[];
  members: OrganizationMemberRecord[];
};

async function load(): Promise<Store> {
  return readJsonFile<Store>("organizations.json", {
    organizations: [],
    members: [],
  });
}

async function save(store: Store) {
  await writeJsonFile("organizations.json", store);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function now() {
  return new Date().toISOString();
}

export const organizationRepository = {
  async listForUser(userId: string) {
    const store = await load();
    const memberOf = store.members.filter((m) => m.userId === userId).map((m) => m.organizationId);
    return store.organizations
      .filter((o) => o.ownerId === userId || memberOf.includes(o.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(userId: string, id: string) {
    const store = await load();
    const org = store.organizations.find((o) => o.id === id);
    if (!org) return null;
    const isMember =
      org.ownerId === userId || store.members.some((m) => m.organizationId === id && m.userId === userId);
    if (!isMember) return null;
    const members = store.members.filter((m) => m.organizationId === id);
    return { organization: org, members };
  },

  async create(userId: string, name: string) {
    const store = await load();
    const stamp = now();
    const org: OrganizationRecord = {
      id: crypto.randomUUID(),
      name: name.trim(),
      slug: `${slugify(name) || "org"}-${crypto.randomUUID().slice(0, 6)}`,
      ownerId: userId,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const member: OrganizationMemberRecord = {
      id: crypto.randomUUID(),
      organizationId: org.id,
      userId,
      email: `${userId}@local`,
      role: "owner",
      createdAt: stamp,
    };
    store.organizations.unshift(org);
    store.members.unshift(member);
    await save(store);
    return org;
  },

  async addMember(userId: string, orgId: string, email: string, role: "admin" | "member") {
    const store = await load();
    const org = store.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    const actor = store.members.find((m) => m.organizationId === orgId && m.userId === userId);
    const canInvite = org.ownerId === userId || actor?.role === "admin" || actor?.role === "owner";
    if (!canInvite) return null;

    const member: OrganizationMemberRecord = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId: `invite_${crypto.randomUUID().slice(0, 8)}`,
      email,
      role,
      createdAt: now(),
    };
    store.members.push(member);
    org.updatedAt = now();
    await save(store);
    return member;
  },
};
