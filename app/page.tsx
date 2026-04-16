export const dynamic = "force-dynamic";

import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  let isConfigured = false;
  try {
    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    isConfigured = !!config;
  } catch {
    isConfigured = false;
  }

  if (isConfigured) {
    redirect('/jukebox');
  } else {
    redirect('/setup');
  }
}
