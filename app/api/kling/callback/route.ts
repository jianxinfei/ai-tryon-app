/**
 * 可灵 AI 任务状态回调接口
 *
 * 路径: app/api/kling/callback/route.ts
 * 方法: POST
 *
 * 接收可灵 AI 的任务状态变更回调通知，
 * 将结果存入 tryon_callback_results 表（使用 UPSERT 按 task_id 去重）。
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  console.log('[Kling Callback] === 收到可灵 AI 回调通知 ===');

  try {
    // 1. 解析请求体
    const body = await req.json();
    const { task_id, task_status, task_status_msg, task_result } = body;

    console.log('[Kling Callback] task_id:', task_id);
    console.log('[Kling Callback] task_status:', task_status);
    console.log('[Kling Callback] task_status_msg:', task_status_msg);
    console.log('[Kling Callback] task_result:', JSON.stringify(task_result, null, 2));

    // 2. 提取结果图片 URL（仅在 succeed 时）
    let resultImageUrl: string | null = null;
    if (task_status === 'succeed' && task_result?.images?.length > 0) {
      resultImageUrl = task_result.images[0].url;
      console.log('[Kling Callback] resultImageUrl:', resultImageUrl);
    }

    // 3. 存入 Supabase（使用 service role key 绕过 RLS）
    const { getSupabaseAdmin } = await import('@/lib/supabase-admin');
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from('tryon_callback_results')
      .upsert(
        {
          task_id,
          task_status,
          result_image_url: resultImageUrl,
          task_status_msg: task_status_msg || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'task_id',
        },
      );

    if (error) {
      console.error('[Kling Callback] Supabase 写入失败:', error.message);
      return NextResponse.json(
        { success: false, error: '存储回调结果失败' },
        { status: 500 },
      );
    }

    console.log('[Kling Callback] 回调结果已存入 Supabase, task_id:', task_id, ', status:', task_status);

    // 4. 返回 200 OK 给可灵
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Kling Callback] 处理回调异常:', err.message);
    // 即使异常也返回 200，避免可灵重复回调
    return NextResponse.json({ success: true });
  }
}
