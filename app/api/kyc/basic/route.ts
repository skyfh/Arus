import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/auth/db';
import { currentUser } from '@/lib/auth/session.server';

const Body = z.object({
  country: z.string().min(2).max(60),
  idType: z.enum(['NRIC', 'PASSPORT']),
  idNumber: z.string().min(4).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Basic KYC: only the last 4 of the ID is ever stored. Sets tier BASIC ($1,000/day combined limit). */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const j = await req.json().catch(() => null);
  const parsed = Body.safeParse(j);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Fill in your country, ID type, ID number and date of birth.' }, { status: 400 });
  }
  const { country, idType, idNumber, dateOfBirth } = parsed.data;

  // Reject obviously fake DOBs (must be 13+ years old, alive range)
  const dob = new Date(dateOfBirth);
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (Number.isNaN(dob.getTime()) || age < 13 || age > 120) {
    return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: u.id },
    data: {
      kycTier: 'BASIC',
      kycCountry: country.trim(),
      kycIdType: idType,
      kycIdLast4: idNumber.slice(-4), // NEVER the full ID number
    },
  });
  return NextResponse.json({ ok: true, tier: 'BASIC', dailyLimitUsdMinor: '1000000000' }); // $1,000
}
