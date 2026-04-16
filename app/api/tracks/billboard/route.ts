export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Billboard chart data lookup via LLM, with caching
export async function GET(req: NextRequest) {
  try {
    const trackId = req.nextUrl.searchParams.get('trackId');
    if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });

    const track = await prisma.cachedTrack.findUnique({
      where: { id: trackId },
      select: { id: true, title: true, artistName: true, year: true, billboardPeak: true, billboardWeeks: true, billboardCheckedAt: true },
    });
    if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

    // Check if we already have cached data
    if (track.billboardCheckedAt) {
      const ageMs = Date.now() - new Date(track.billboardCheckedAt).getTime();
      const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
      const trackAge = track.year ? (new Date().getFullYear() - track.year) : 999;
      // Songs > 6 months old: never re-check. Newer songs: re-check after 7 days.
      if (trackAge > 0.5) {
        return NextResponse.json({ peak: track.billboardPeak, weeks: track.billboardWeeks, cached: true });
      }
      if (ageMs < oneWeekMs) {
        return NextResponse.json({ peak: track.billboardPeak, weeks: track.billboardWeeks, cached: true });
      }
    }

    // Look up via LLM
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'LLM API not configured' }, { status: 500 });

    const prompt = `For the song "${track.title}" by ${track.artistName || 'unknown artist'}${track.year ? ` (${track.year})` : ''}, provide its Billboard Hot 100 chart performance data. Return peak_position as the highest chart position (integer 1-100) and weeks_on_chart as total weeks spent on the chart (integer). If this song was never on the Billboard Hot 100 or you are not confident, return -1 for both values. Respond ONLY with a JSON object.`;

    const llmRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are a music chart data expert. Return only valid JSON with peak_position and weeks_on_chart as integers. Use -1 if the song was never charted.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text().catch(() => '');
      console.error('LLM API error:', llmRes.status, errText);
      return NextResponse.json({ error: 'LLM lookup failed', status: llmRes.status }, { status: 500 });
    }

    const llmData = await llmRes.json();
    const content = llmData?.choices?.[0]?.message?.content;
    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse LLM response:', content);
      return NextResponse.json({ error: 'Parse error', raw: content }, { status: 500 });
    }

    const rawPeak = typeof parsed?.peak_position === 'number' ? parsed.peak_position : -1;
    const rawWeeks = typeof parsed?.weeks_on_chart === 'number' ? parsed.weeks_on_chart : -1;
    // -1 means not charted or unknown
    const peak = rawPeak > 0 ? rawPeak : null;
    const weeks = rawWeeks > 0 ? rawWeeks : null;

    // Cache in DB
    await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { billboardPeak: peak, billboardWeeks: weeks, billboardCheckedAt: new Date() },
    });

    return NextResponse.json({ peak, weeks, cached: false });
  } catch (e: any) {
    console.error('Billboard lookup error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
