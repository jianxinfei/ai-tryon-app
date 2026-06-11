/**
 * 试衣历史记录删除 API
 *
 * 路径: app/api/tryon/history/[recordId]/route.ts
 * 方法: DELETE
 *
 * 验证用户身份后，删除 tryon_history 表中对应记录
 * 安全策略：用户只能删除自己的记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  const { recordId } = params;
  console.log('[TryOn History Delete] 收到删除请求, recordId:', recordId);

  try {
    // 验证用户登录
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[TryOn History Delete] Supabase 环境变量未配置');
      return NextResponse.json({ success: false, error: '服务器配置错误' }, { status: 500 });
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() { return allCookies; },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (e) { console.error('[TryOn History Delete] setAll() 错误:', e); }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let userId = '';

    if (authError && authError.message?.includes('token is expired')) {
      console.log('[TryOn History Delete] token 过期，尝试刷新...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        return NextResponse.json({ success: false, error: '登录已过期，请重新登录', needLogin: true }, { status: 401 });
      }
      const retryResult = await supabase.auth.getUser();
      if (!retryResult.data.user) {
        return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 });
      }
      userId = retryResult.data.user.id;
    } else if (authError || !user) {
      return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 });
    } else {
      userId = user.id;
    }

    // 验证 recordId 格式（UUID）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(recordId)) {
      return NextResponse.json({ success: false, error: '无效的记录ID' }, { status: 400 });
    }

    // 安全策略：先查询记录，确认属于当前用户（用 admin 绕过 RLS）
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabaseAdmin = getSupabaseAdmin();

    const { data: record, error: queryError } = await supabaseAdmin
      .from('tryon_history')
      .select('id, user_id')
      .eq('id', recordId)
      .maybeSingle();

    if (queryError) {
      console.error('[TryOn History Delete] 查询记录失败:', queryError.message);
      return NextResponse.json({ success: false, error: '查询记录失败' }, { status: 500 });
    }

    if (!record) {
      console.log('[TryOn History Delete] 记录不存在, recordId:', recordId);
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    if (record.user_id !== userId) {
      console.warn('[TryOn History Delete] 用户尝试删除他人的记录, userId:', userId, ', recordUserId:', record.user_id);
      return NextResponse.json({ success: false, error: '无权删除此记录' }, { status: 403 });
    }

    // 执行删除（用 admin 绕过 RLS，确保删除成功）
    const { error: deleteError } = await supabaseAdmin
      .from('tryon_history')
      .delete()
      .eq('id', recordId);

    if (deleteError) {
      console.error('[TryOn History Delete] 删除失败:', deleteError.message);
      return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
    }

    console.log('[TryOn History Delete] 删除成功, recordId:', recordId, ', userId:', userId);
    return NextResponse.json({ success: true, message: '删除成功' });

  } catch (err: any) {
    console.error('[TryOn History Delete] 异常:', err.message);
    return NextResponse.json({ success: false, error: err.message || '删除异常' }, { status: 500 });
  }
}
