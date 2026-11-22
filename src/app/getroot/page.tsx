import { getrootLockAction, getrootUnlockAction } from "@/lib/actions";
import { hasGetRootAccess } from "@/lib/getroot";

export const dynamic = "force-dynamic";

export default async function GetRootPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const unlocked = hasGetRootAccess();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-amber-400 text-xl font-black text-slate-950">
            ⚿
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">getroot</h1>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-500">restricted admin access</p>
        </div>

        <div className="card border-slate-800 bg-slate-900 text-white">
          {unlocked ? (
            <>
              <h2 className="text-lg font-bold text-emerald-400">Root session active ✅</h2>
              <p className="mt-2 text-sm text-slate-400">
                You can manage subscriptions and moderation in the admin panel.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="/admin" className="btn-primary">Open admin panel →</a>
                <form action={getrootLockAction}>
                  <button type="submit" className="btn-secondary">Exit root session</button>
                </form>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold">Enter the admin PIN</h2>
              <p className="mt-1 text-sm text-slate-400">
                This entrance is hidden. The code is only known by the platform owner.
              </p>
              {searchParams.error && (
                <p className="mt-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
                  Wrong PIN. Try again.
                </p>
              )}
              <form action={getrootUnlockAction} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">PIN code</span>
                  <input
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    required
                    placeholder="••••"
                    className="input mt-1 w-full bg-slate-950 text-center text-2xl tracking-[0.6em] text-white placeholder:text-slate-700"
                  />
                </label>
                <button type="submit" className="btn-primary w-full">Unlock admin access</button>
              </form>
              <p className="mt-4 text-center text-[11px] text-slate-600">Demo code for this build: 2007</p>
            </>
          )}
        </div>

        <a href="/" className="mt-6 block text-center text-xs text-slate-600 hover:text-slate-400">
          ← Back to GetBoth.tn
        </a>
      </div>
    </main>
  );
}
