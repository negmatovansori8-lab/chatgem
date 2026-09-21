"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrganizationMemberRecord, OrganizationRecord } from "@/types/business";

export function TeamWorkspace() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [selected, setSelected] = useState<OrganizationRecord | null>(null);
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function refreshOrgs() {
    const res = await fetch("/api/organizations");
    const data = await res.json();
    setOrganizations(data.organizations ?? []);
  }

  async function openOrg(id: string) {
    const res = await fetch(`/api/organizations/${id}`);
    const data = await res.json();
    setSelected(data.organization ?? null);
    setMembers(data.members ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/organizations");
      const data = await res.json();
      if (cancelled) return;
      setOrganizations(data.organizations ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createOrg(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setName("");
    await refreshOrgs();
    if (data.organization) void openOrg(data.organization.id);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!selected || !email.trim()) return;
    await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: selected.id, email, role: "member" }),
    });
    setEmail("");
    await openOrg(selected.id);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_1.2fr] sm:px-6">
      <section className="space-y-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--fg)]">
            Team workspace
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Organizations, members, and roles for Business plans.
          </p>
        </div>
        <form
          onSubmit={createOrg}
          className="flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organization name" />
          <Button type="submit">Create</Button>
        </form>
        <ul className="space-y-2">
          {organizations.map((org) => (
            <li key={org.id}>
              <button
                type="button"
                onClick={() => void openOrg(org.id)}
                className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left"
              >
                <Building2 className="h-4 w-4 text-[var(--accent)]" />
                <span className="text-sm font-medium">{org.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {selected ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <p className="text-xs text-[var(--fg-subtle)]">/{selected.slug}</p>
            <form onSubmit={invite} className="flex gap-2">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Invite email"
                type="email"
              />
              <Button type="submit">
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            </form>
            <ul className="space-y-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span>{member.email}</span>
                  <span className="text-xs uppercase text-[var(--fg-subtle)]">{member.role}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">Select or create an organization.</p>
        )}
      </section>
    </div>
  );
}
