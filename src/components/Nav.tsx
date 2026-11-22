import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type NavProps = {
  name: string;
  role: string;
  links: { href: string; label: string }[];
};

export default function Nav({ name, role, links }: NavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-3 text-lg font-black tracking-tight text-brand-800">
          GetBoth<span className="text-amber-500">.tn</span>
          <span className="ml-2 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 sm:inline">
            Freelance
          </span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="hidden text-sm text-slate-500 sm:block">
          {name} <span className="badge bg-brand-50 text-brand-700">{role}</span>
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
