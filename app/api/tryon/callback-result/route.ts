/**
 * 回调结果查询接口
 *
 * 路径: app/api/tryon/callback-result/route.ts
 * 方法: POST
 *
 * 供前端轮询查询可灵 AI 回调结果（从 tryon_callback_results 表查询）。
 * 使用 supabase-admin 绕过 RLS。
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求体，获取 taskId
    const body = await req.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 },
      );
    }

    // 2. 从 tryon_callback_results 表查询
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('tryon_callback_results')
      .select('task_id, task_status, result_image_url, task_status_msg')
      .eq('task_id', taskId)
      .maybeSingle();

    if (error) {
      console.error('[Callback Result] 查询失败:', error.message);
      return NextResponse.json(
        { success: true, status: 'processing' },
      );
    }

    // 3. 根据查询结果返回
    if (!data) {
      // 没找到记录，说明回调还没到
      return NextResponse.json({ success: true, status: 'processing' });
    }

    if (data.task_status === 'succeed') {
      return NextResponse.json({
        success: true,
        resultUrl: data.result_image_url,
        status: 'succeed',
      });
    }

    if (data.task_status === 'failed') {
      return NextResponse.json({
        success: false,
        error: data.task_status_msg || '试衣失败',
        status: 'failed',
      });
    }

    // 其他状态（submitted / processing）视为处理中
    return NextResponse.json({ success: true, status: 'processing' });
  } catch (err: any) {
    console.error('[Callback Result] 查询异常:', err.message);
    return NextResponse.json({ success: true, status: 'processing' });
  }
}
