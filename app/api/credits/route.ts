/**
 * 积分查询 & 扣减 API
 *
 * 路径: app/api/credits/route.ts
 *
 * GET  → 查询用户积分状态
 * POST → 消耗一次试衣机会
 *
 * 认证方式：通过 req.headers.cookie 读取 Supabase session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkUserCanTryOn, consumeTryOn } from '@/lib/credits';

// ══════════════════════════════════════════════
// 服务端用户认证（从 req.headers.cookie 中获取 Supabase session）
// ══════════════════════════════════════════════

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return [];
  return cookieHeader.split(';').map((cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    return { name, value: rest.join('=') };
  });
}

async function getAuthUser(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  const allCookies = parseCookieHeader(cookieHeader);
  
  console.log('[Credits API] cookie header length:', cookieHeader?.length || 0);
  console.log('[Credits API] parsed cookies count:', allCookies.length);
  console.log('[Credits API] cookie names:', allCookies.map(c => c.name));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return allCookies; },
        setAll() { /* 只读，不需要设置 */ },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('[Credits API] getUser error:', error.message);
    return null;
  }
  if (!user) {
    console.log('[Credits API] getUser returned no user');
    return null;
  }
  console.log('[Credits API] authenticated user:', user.id);
  return user;
}

// ── GET: 查询积分 ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 直接查询积分（服务端使用 service role 不受 RLS 限制）
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: creditData } = await supabaseAdmin
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    const check = await checkUserCanTryOn(user.id);

    return NextResponse.json({
      credits_balance: creditData?.credits ?? 0,
      can_try: check.can_try,
      use_type: check.use_type,
    });
  } catch (err: any) {
    console.error('[Credits API] GET 出错:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: 消耗一次试衣 ──
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const referenceId = body.referenceId;

    // 先检查
    const check = await checkUserCanTryOn(user.id);

    if (!check.can_try) {
      return NextResponse.json(
        {
          success: false,
          reason: check.reason,
          message: '积分不足，请购买积分包',
          redirect_to: '/pricing',
        },
        { status: 403 },
      );
    }

    // 执行扣减
    const result = await consumeTryOn(user.id, referenceId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          reason: result.error,
          message: '扣减失败',
          redirect_to: '/pricing',
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      use_type: result.use_type,
      credits_balance: result.credits_balance,
    });
  } catch (err: any) {
    console.error('[Credits API] POST 出错:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
