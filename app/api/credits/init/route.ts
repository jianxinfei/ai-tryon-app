/**
 * 用户积分初始化 API
 *
 * 路径: app/api/credits/init/route.ts
 * 方法: POST
 *
 * 在用户首次注册后调用，初始化积分记录。
 * 使用 upsert 确保幂等性（重复调用不会创建重复记录）。
 *
 * 请求体: { userId: string }
 * 响应: { success: boolean, credits: number }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
    }

    // 动态导入 Supabase（避免构建时加载环境变量）
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Credits Init] 缺少 Supabase 环境变量');
      return NextResponse.json({ error: '服务器配置错误' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 使用 upsert：如果记录已存在则不覆盖，不存在则创建
    const { data, error } = await supabase
      .from('user_credits')
      .upsert(
        {
          user_id: userId,
          credits: 0,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[Credits Init] upsert 失败:', error);
      return NextResponse.json({ error: '初始化积分失败' }, { status: 500 });
    }

    console.log(`[Credits Init] 用户积分初始化成功: userId=${userId}, credits=0`);

    return NextResponse.json({
      success: true,
      credits: data.credits,
    });

  } catch (err: any) {
    console.error('[Credits Init] 异常:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
