import Nav from "@/components/Nav";
import { requireAdminOrRoot } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminOrRoot();
  return (
    <>
      <Nav
        name={user.name}
        role="ADMIN"
        links={[
          { href: "/admin", label: "Moderation" },
          { href: "/admin#subscriptions", label: "Subscriptions" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
