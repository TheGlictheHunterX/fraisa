import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { homeForRole } from "@/lib/session";

/** Indicative national context, rounded from public INS / World Bank figures. */
const tunisiaFacts = [
  {
    value: "41%",
    label: "Youth unemployment",
    detail: "15–24 year-olds, indicative recent rate",
    accent: "bg-brand-600",
  },
  {
    value: "≈52%",
    label: "Informal work",
    detail: "Share of employment outside the formal sector",
    accent: "bg-amber-500",
  },
  {
    value: "250K+",
    label: "University students",
    detail: "Potential short-shift workforce",
    accent: "bg-cyan-500",
  },
  {
    value: "≤ 2h",
    label: "GetBoth shift cap",
    detail: "Short enough to fit around class time",
    accent: "bg-brand-800",
  },
];

const steps = [
  {
    n: "01",
    title: "Create your profile",
    text: "Students add their city and school. Businesses add their shop and category. No paperwork, no long forms.",
  },
  {
    n: "02",
    title: "Pick a short shift",
    text: "Browse open offers near you, check the rate and duration, then accept in one click. Every shift is two hours or less.",
  },
  {
    n: "03",
    title: "Chat, show up, earn",
    text: "Accepting opens a private chat with the business. Agree the details, complete the shift, track it in your dashboard.",
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  const dbUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, status: true },
      })
    : null;
  const home = dbUser?.status === "ACTIVE" ? homeForRole(dbUser.role) : null;

  // Real numbers from the demo database. Never let a missing DB break the page.
  let live = { offers: 0, hours: 0, rate: 0, cities: [] as { city: string; count: number }[] };
  try {
    const [offers, hours, rate, cities] = await Promise.all([
      prisma.offer.count({ where: { status: "PENDING" } }),
      prisma.offer.aggregate({
        where: { status: "PENDING" },
        _sum: { durationMin: true },
      }),
      prisma.offer.aggregate({
        where: { status: "PENDING" },
        _avg: { hourlyRate: true },
      }),
      prisma.offer.groupBy({
        by: ["city"],
        where: { status: "PENDING" },
        _count: { _all: true },
        orderBy: { _count: { city: "desc" } },
      }),
    ]);
    live = {
      offers,
      hours: Math.round((hours._sum.durationMin ?? 0) / 60),
      rate: Math.round(rate._avg.hourlyRate ?? 0),
      cities: cities.map((c) => ({ city: c.city, count: c._count._all })),
    };
  } catch {
    // keep the zeroed fallback
  }

  const maxCity = Math.max(1, ...live.cities.map((c) => c.count));

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="hero-grid relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-cyan-50">
        <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-amber-100/50 blur-3xl" />

        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <Link href="/" className="text-xl font-black tracking-tight text-brand-800">
            GetBoth<span className="text-amber-500">.tn</span>
            <span className="ml-3 hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:inline">
              Freelance · Tunisia
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {home ? (
              <Link href={home} className="btn-primary">Go to dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary">Log in</Link>
                <Link href="/register" className="btn-primary">Get started</Link>
              </>
            )}
          </div>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Made for Tunisia — study full-time, work two hours
            </div>
            <h1 className="max-w-2xl text-5xl font-black leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Study smart.
              <br />
              Work <span className="text-brand-600">short.</span>
              <br />
              <span className="text-amber-500">Get both.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
              GetBoth connects Tunisian students with local businesses for paid shifts of
              two hours or less. Find work near campus, chat directly, and keep your studies first.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {home ? (
                <Link href={home} className="btn-primary px-6 py-3 text-base">Open your dashboard →</Link>
              ) : (
                <>
                  <Link href="/register?role=STUDENT" className="btn-primary px-6 py-3 text-base">Find a shift →</Link>
                  <Link href="/register?role=BUSINESS" className="btn-secondary px-6 py-3 text-base">Post an offer</Link>
                </>
              )}
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500">
              <span><strong className="text-slate-900">Free</strong> to join</span>
              <span><strong className="text-slate-900">Private</strong> 1-to-1 chat</span>
              <span><strong className="text-slate-900">Local</strong> businesses</span>
            </div>
          </div>

          {/* Live board — real data from the demo database */}
          <div className="relative">
            <div className="absolute -inset-3 rotate-2 rounded-3xl bg-brand-100/60" />
            <div className="card relative border-0 p-7 shadow-xl shadow-brand-900/10">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Live market board</p>
                  <h2 className="mt-1 text-xl font-extrabold">What&apos;s open on GetBoth</h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">● LIVE</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-brand-50 p-4">
                  <p className="text-3xl font-black text-brand-800">{live.offers}</p>
                  <p className="mt-1 text-xs font-medium text-brand-700">open offers</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-3xl font-black text-amber-700">{live.hours}h</p>
                  <p className="mt-1 text-xs font-medium text-amber-700">available</p>
                </div>
                <div className="rounded-xl bg-cyan-50 p-4">
                  <p className="text-3xl font-black text-cyan-700">{live.rate}</p>
                  <p className="mt-1 text-xs font-medium text-cyan-700">TND / hour avg.</p>
                </div>
              </div>

              <div className="mt-7">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Demand by city</p>
                <div className="space-y-3">
                  {(live.cities.length ? live.cities : [{ city: "Tunis", count: 0 }]).map((c) => (
                    <div key={c.city}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold text-slate-700">{c.city}</span>
                        <span className="text-slate-500">{c.count} offer{c.count === 1 ? "" : "s"}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-600 to-cyan-500"
                          style={{ width: `${Math.max(4, (c.count / maxCity) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-7 border-t border-slate-100 pt-4 text-xs text-slate-400">
                Numbers update from the GetBoth demo database.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Tunisia work stats ───────────────────────────────────────── */}
      <section id="stats" className="border-y border-slate-100 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500">The context</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              Why micro-shifts matter in Tunisia
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Young people need flexible income. Local shops need reliable help at peak hours.
              The gap is timing — and that is exactly what GetBoth solves.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tunisiaFacts.map((fact) => (
              <div key={fact.label} className="card group overflow-hidden p-6">
                <div className={`mb-5 h-1.5 w-12 rounded-full ${fact.accent}`} />
                <p className="text-4xl font-black tracking-tight text-slate-900">{fact.value}</p>
                <p className="mt-2 font-bold text-slate-800">{fact.label}</p>
                <p className="mt-1 text-sm leading-snug text-slate-500">{fact.detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            National figures are indicative, rounded from public INS / World Bank labour-market data and shown for
            demo context only. The “Live market board” above uses real records from this demo&apos;s database.
          </p>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">How it works</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Three steps, one afternoon</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="card relative p-7">
                <span className="absolute right-6 top-5 text-5xl font-black text-brand-50">{step.n}</span>
                <h3 className="relative text-xl font-extrabold text-slate-900">{step.title}</h3>
                <p className="relative mt-3 text-sm leading-relaxed text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two sides ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          <div className="rounded-2xl bg-brand-800 p-8 text-white sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">For students</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Earn without missing class</h2>
            <ul className="mt-7 space-y-4 text-sm leading-relaxed text-brand-50">
              <li><strong className="text-white">Short by design.</strong> Every shift is 120 minutes or less.</li>
              <li><strong className="text-white">Transparent pay.</strong> See the hourly rate before you accept.</li>
              <li><strong className="text-white">Direct contact.</strong> One private chat, no agency in between.</li>
              <li><strong className="text-white">Your record.</strong> Accepted shifts and earnings in one dashboard.</li>
            </ul>
            <Link href="/register?role=STUDENT" className="mt-8 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-brand-800 hover:bg-brand-50">
              Find a shift →
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">For businesses</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">Help exactly when you need it</h2>
            <ul className="mt-7 space-y-4 text-sm leading-relaxed text-slate-600">
              <li><strong className="text-slate-900">Post in minutes.</strong> Title, city, rate and duration — that&apos;s it.</li>
              <li><strong className="text-slate-900">Local applicants.</strong> Students already near your shop.</li>
              <li><strong className="text-slate-900">Chat to confirm.</strong> Sort out timing without phone tag.</li>
              <li><strong className="text-slate-900">Stay in control.</strong> Close an offer whenever you want.</li>
            </ul>
            <Link href="/register?role=BUSINESS" className="btn-primary mt-8 inline-flex">
              Post an offer →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-brand-700 to-cyan-600">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-20">
          <h2 className="max-w-2xl text-3xl font-black text-white sm:text-5xl">Two hours today can change your week.</h2>
          <p className="max-w-xl text-brand-50">Join the Tunisian short-shift network — free, local and built around your schedule.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="inline-flex rounded-lg bg-white px-6 py-3 text-sm font-bold text-brand-800 hover:bg-brand-50">
              Create free account
            </Link>
            <Link href="/login" className="inline-flex rounded-lg border border-white/50 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-8 text-center text-sm text-slate-400">
        GetBoth.tn — Freelance edition · Made in Tunisia 🇹🇳 · Demo project
      </footer>
    </main>
  );
}
