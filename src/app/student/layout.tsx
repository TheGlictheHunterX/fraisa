import Nav from "@/components/Nav";
import { requireUser } from "@/lib/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  return (
    <>
      <Nav
        name={user.name}
        role="STUDENT"
        links={[
          { href: "/student/dashboard", label: "Dashboard" },
          { href: "/student/offers", label: "Browse offers" },
          { href: "/student/work-log", label: "Work log" },
          { href: "/student/wallet", label: "Wallet" },
          { href: "/student/chat", label: "My chats" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
