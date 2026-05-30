/**
 * 积分查询 & 扣减 API
 *
 * 路径: app/api/credits/route.ts
 *
 * GET  → 查询用户积分状态
 * POST → 消耗一次试衣机会
 *
 * 认证方式：通过 createServerClient + cookies() 读取 Supabase session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkUserCanTryOn, consumeTryOn } from '@/lib/credits';

// ══════════════════════════════════════════════
// 服务端用户认证（从 cookie 中获取 Supabase session）
// ══════════════════════════════════════════════

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* 忽略 */ }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ── GET: 查询积分 ──
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
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
    console.error('[Credits] GET 出错:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: 消耗一次试衣 ──
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
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
    console.error('[Credits] POST 出错:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
