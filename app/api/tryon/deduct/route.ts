/**
 * 试衣积分扣减 API
 *
 * 路径: app/api/tryon/deduct/route.ts
 * 方法: POST
 *
 * 用于在试衣任务成功后扣减积分，并记录试衣历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { consumeCredits, getUserCredits } from '@/lib/credits';

export async function POST(req: NextRequest) {
  console.log('[TryOn Deduct] 收到积分扣减请求');

  try {
    // 验证用户登录
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[TryOn Deduct] Supabase 环境变量未配置');
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
            } catch (e) { console.error('[TryOn Deduct] setAll() 错误:', e); }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let userId = '';

    // 如果 token 过期，尝试刷新
    if (authError && authError.message?.includes('token is expired')) {
      console.log('[TryOn Deduct] token 过期，尝试刷新...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('[TryOn Deduct] token 刷新失败:', refreshError.message);
        return NextResponse.json({ success: false, error: '登录已过期，请重新登录', needLogin: true }, { status: 401 });
      }
      const retryResult = await supabase.auth.getUser();
      if (!retryResult.data.user) {
        return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 });
      }
      userId = retryResult.data.user.id;
    } else if (authError || !user) {
      console.error('[TryOn Deduct] 用户未登录');
      return NextResponse.json({ success: false, error: '用户未登录' }, { status: 401 });
    } else {
      userId = user.id;
    }

    console.log('[TryOn Deduct] 用户ID:', userId);

    // 解析请求体（获取图片 URL，用于记录历史）
    let personImageUrl = '';
    let clothingImageUrl = '';
    let resultImageUrl = '';
    try {
      const body = await req.json();
      personImageUrl = body.personImageUrl || '';
      clothingImageUrl = body.clothingImageUrl || '';
      resultImageUrl = body.resultImageUrl || '';
    } catch {
      // 兼容旧版本前端（不传 body）
    }

    // 扣减 1 积分
    const deductResult = await consumeCredits(userId, 1, '虚拟试衣');

    if (!deductResult.success) {
      console.error('[TryOn Deduct] 积分扣减失败:', deductResult.error);
      return NextResponse.json({ success: false, error: deductResult.error || '积分扣减失败' });
    }

    console.log('[TryOn Deduct] 积分扣减成功，剩余:', deductResult.credits_balance);

    // 记录试衣历史（如果有图片 URL）
    if (personImageUrl && clothingImageUrl && resultImageUrl) {
      try {
        const { error: insertError } = await supabase
          .from('tryon_history')
          .insert({
            user_id: userId,
            person_image_url: personImageUrl,
            clothing_image_url: clothingImageUrl,
            result_image_url: resultImageUrl,
          });

        if (insertError) {
          console.error('[TryOn Deduct] 记录试衣历史失败:', insertError.message);
        } else {
          console.log('[TryOn Deduct] 试衣历史记录成功');
        }
      } catch (historyErr: any) {
        console.error('[TryOn Deduct] 记录试衣历史异常:', historyErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      creditsBalance: deductResult.credits_balance,
      creditsConsumed: 1,
    });

  } catch (err: any) {
    console.error('[TryOn Deduct] 异常:', err.message);
    return NextResponse.json({ success: false, error: err.message || '积分扣减异常' }, { status: 500 });
  }
}
