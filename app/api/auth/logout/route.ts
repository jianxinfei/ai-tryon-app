/**
 * 退出登录 API
 *
 * 路径: app/api/auth/logout/route.ts
 *
 * POST → 清除用户 session
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST() {
  try {
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

    // 清除 Supabase session
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: '已退出登录' });
  } catch (error) {
    console.error('[Auth] 退出登录失败:', error);
    return NextResponse.json({ error: '退出登录失败' }, { status: 500 });
  }
}
