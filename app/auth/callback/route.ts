/**
 * Auth 回调路由
 *
 * 路径: app/auth/callback/route.ts
 *
 * Supabase Auth 完成邮箱验证或 OAuth 登录后，
 * 会重定向到此路由。此路由负责：
 * 1. 交换 code 为 session
 * 2. 重定向回用户之前访问的页面
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        // 成功，重定向回之前的页面
        return NextResponse.redirect(`${origin}${next}`);
      }

      console.error('[Auth Callback] exchangeCodeForSession 失败:', error.message);
    } catch (err: any) {
      console.error('[Auth Callback] 异常:', err.message);
    }
  }

  // 失败，重定向到登录页并显示错误
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
