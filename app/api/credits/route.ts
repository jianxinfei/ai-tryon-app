/**
 * 积分查询 & 扣减 API
 *
 * 路径: app/api/credits/route.ts
 *
 * GET  → 查询用户积分状态
 * POST → 消耗一次试衣机会
 *
 * 认证方式：使用 @supabase/ssr createServerClient，自动处理 token 刷新
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { checkUserCanTryOn, consumeTryOn } from '@/lib/credits';

// ══════════════════════════════════════════════
// 服务端用户认证（使用 createServerClient 自动处理 token 刷新）
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
          } catch (e) {
            console.error('[Credits API] setAll cookies error:', e);
          }
        },
      },
    }
  );

  let { data: { user }, error } = await supabase.auth.getUser();
  
  // 如果 token 过期，尝试刷新
  if (error && error.message?.includes('token is expired')) {
    console.log('[Credits API] token 过期，尝试刷新...');
    const { error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error('[Credits API] token 刷新失败:', refreshError.message);
      // 刷新也失败，清除所有认证 Cookie，让前端恢复到未登录状态
      clearAuthCookies(cookieStore);
      return null;
    }
    
    console.log('[Credits API] token 刷新成功，重新获取用户...');
    const retryResult = await supabase.auth.getUser();
    user = retryResult.data.user;
    error = retryResult.error;
  }

  if (error) {
    console.error('[Credits API] getUser error:', error.message);
    clearAuthCookies(cookieStore);
    return null;
  }
  if (!user) {
    console.log('[Credits API] getUser returned no user');
    return null;
  }
  console.log('[Credits API] authenticated user:', user.id);
  return user;
}

// 清除所有 Supabase 认证 Cookie
function clearAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    const allCookies = cookieStore.getAll();
    allCookies.forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        cookieStore.set(name, '', { maxAge: 0, path: '/' });
      }
    });
    console.log('[Credits API] 已清除所有认证 Cookie');
  } catch (e) {
    console.error('[Credits API] 清除 Cookie 失败:', e);
  }
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

    // 查询是否有成功购买记录（用于新老用户判断）
    const { data: purchaseRecords } = await supabaseAdmin
      .from('credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('transaction_type', 'purchase')
      .limit(1);

    const hasPurchaseRecord = !!(purchaseRecords && purchaseRecords.length > 0);

    return NextResponse.json({
      credits_balance: creditData?.credits ?? 0,
      can_try: check.can_try,
      use_type: check.use_type,
      hasPurchaseRecord,
    });
  } catch (err: any) {
    console.error('[Credits API] GET 出错:', err);
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
    console.error('[Credits API] POST 出错:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
