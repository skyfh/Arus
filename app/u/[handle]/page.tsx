import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/auth/db';

export const dynamic = 'force-dynamic';

/** Public profile /u/[handle]: name, handle, Pay button, QR code. No email, no address. */
export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const u = await prisma.user.findUnique({ where: { handle: handle.toLowerCase() } });
  if (!u) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center flex flex-col gap-4" aria-labelledby="profile-h">
        <div className="w-16 h-16 rounded-full bg-[color:var(--ink)] text-white grid place-items-center text-xl font-bold mx-auto" aria-hidden>
          {u.name.slice(0, 1).toUpperCase()}
        </div>
        <h1 id="profile-h" className="text-2xl font-bold">{u.name}</h1>
        <p className="text-[color:var(--ink-muted)] tnum">{u.handle}@arus</p>
        <Link
          href={`/send?to=${encodeURIComponent(u.handle)}`}
          className="btn-primary inline-block"
        >
          Pay {u.handle}@arus
        </Link>
        <div className="text-xs text-[color:var(--ink-muted)]">
          QR codes encode {process.env.NEXT_PUBLIC_APP_URL || ''}/u/{u.handle}
        </div>
        <p className="text-xs text-[color:var(--pending)]">Demo on Sui testnet — no real money.</p>
      </div>
    </main>
  );
}
