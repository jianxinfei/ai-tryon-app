/**
 * AI 虚拟试衣任务状态查询 API
 *
 * 路径: app/api/tryon/status/route.ts
 * 方法: POST
 *
 * 用于前端轮询查询可灵 AI 试衣任务的状态和结果
 * 任务完成后，直接返回可灵原始图片 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { rollbackCredits } from '@/lib/credits';

// ══════════════════════════════════════════════
// 可灵 AI 配置
// ══════════════════════════════════════════════

const KLING_API_BASE = 'https://api-beijing.klingai.com';

// ══════════════════════════════════════════════
// 可灵 AI API Key 鉴权
// ══════════════════════════════════════════════

function getKlingAuthHeaders(): Record<string, string> {
  const apiKey = process.env.KLING_API_KEY;

  if (!apiKey) {
    throw new Error('KLING_API_KEY 未配置');
  }

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };
}

// ══════════════════════════════════════════════
// 查询可灵 AI 任务状态
// ══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log('[TryOn Status] 收到状态查询请求');

  let taskId: string | undefined;

  try {
    // 解析请求体
    const body = await req.json().catch(() => ({}));
    taskId = body.taskId;
    const userId = body.userId; // 用于积分回滚
    const isExternalTaskId = body.isExternalTaskId || false; // 是否为自定义任务 ID

    if (!taskId) {
      console.log('[TryOn Status] 参数错误：缺少 taskId');
      return NextResponse.json({
        success: false,
        error: '缺少任务ID',
      }, { status: 400 });
    }

    const idType = isExternalTaskId ? 'external_task_id' : 'task_id';
    console.log('[TryOn Status] 查询任务状态:', taskId, '(类型:', idType + ')');

    // 构建查询 URL（支持通过 external_task_id 查询）
    // 可灵文档标注 GET，但实际 API 可能要求 POST，这里统一用 POST 以兼容
    let url: string;
    if (isExternalTaskId) {
      url = `${KLING_API_BASE}/v1/images/kolors-virtual-try-on/${encodeURIComponent(taskId)}?external_task_id=true`;
    } else {
      url = `${KLING_API_BASE}/v1/images/kolors-virtual-try-on/${encodeURIComponent(taskId)}`;
    }
    const headers = getKlingAuthHeaders();

    console.log('[TryOn Status] 请求可灵 API:', url, ', method: GET');

    // 调用可灵 API（先尝试 GET，如果返回 1202 则降级为 POST）
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000), // 15秒超时
      });

      // 如果 GET 返回 404 + 1202 (method invalid)，降级为 POST 重试
      if (!response.ok) {
        let errorData: any = {};
        try { errorData = await response.json(); } catch { /* ignore */ }
        const klingCode = errorData?.code || errorData?.data?.code;

        if (klingCode === 1202 || klingCode === 1202) {
          console.warn('[TryOn Status] GET 请求返回 1202 (method invalid)，降级为 POST 重试');
          response = await fetch(url, {
            method: 'POST',
            headers,
            signal: AbortSignal.timeout(15000),
          });
        }
      }
    } catch (fetchErr: any) {
      console.error('[TryOn Status] fetch 调用失败:', fetchErr.message);
      return NextResponse.json({
        success: false,
        error: '网络请求失败，请稍后重试',
      }, { status: 502 });
    }

    // 检查 HTTP 状态码
    if (!response.ok) {
      console.error('[TryOn Status] 可灵 API 返回错误状态:', response.status, response.statusText);
      
      // 处理无效或过期的 taskId
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: '任务不存在或已过期',
        }, { status: 404 });
      }
      
      if (response.status === 410) {
        return NextResponse.json({
          success: false,
          error: '任务已过期，请重新创建',
        }, { status: 410 });
      }
      
      return NextResponse.json({
        success: false,
        error: `可灵服务异常 (${response.status})，请稍后重试`,
      }, { status: 502 });
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseErr: any) {
      console.error('[TryOn Status] 解析可灵响应失败:', parseErr.message);
      return NextResponse.json({
        success: false,
        error: '服务器响应解析失败',
      }, { status: 500 });
    }

    console.log('[TryOn Status] 可灵 API 响应:', JSON.stringify(data));

    // 提取任务数据
    const taskData = data.data || data;
    const taskStatus = taskData.task_status;

    // 任务完成
    if (taskStatus === 'succeed') {
      const rawResultUrl = taskData.task_result?.images?.[0]?.url;

      if (!rawResultUrl) {
        console.error('[TryOn Status] 任务成功但无结果图片');
        return NextResponse.json({
          success: false,
          error: '任务成功但未获取到结果图片',
        });
      }

      console.log('[TryOn Status] 任务完成，原始 URL:', rawResultUrl);

      return NextResponse.json({
        success: true,
        resultUrl: rawResultUrl,
      });
    }

    // 任务处理中
    if (taskStatus === 'pending' || taskStatus === 'running') {
      console.log('[TryOn Status] 任务处理中');
      return NextResponse.json({
        success: true,
        status: 'processing',
      });
    }

    // 任务失败
    if (taskStatus === 'failed') {
      const errorMsg = taskData.error?.message || taskData.message || taskData.fail_reason || '任务失败';
      console.error('[TryOn Status] 任务失败:', errorMsg);
      
      // 回滚积分（如果提供了 userId）
      if (userId) {
        try {
          console.log('[TryOn Status] 任务失败，回滚积分...');
          await rollbackCredits(userId, 1, '试衣任务失败，回滚积分');
          console.log('[TryOn Status] 积分回滚成功');
        } catch (rollbackErr: any) {
          console.error('[TryOn Status] 积分回滚失败:', rollbackErr.message);
        }
      }
      
      return NextResponse.json({
        success: false,
        error: errorMsg,
      });
    }

    // 未知状态 - 视为处理中
    console.log('[TryOn Status] 任务状态未知:', taskStatus);
    return NextResponse.json({
      success: true,
      status: 'processing',
    });

  } catch (err: any) {
    console.error('[TryOn Status] 查询异常:', {
      message: err.message,
      stack: err.stack,
      taskId: taskId,
      name: err.name
    });

    // 返回友好错误，不暴露内部细节
    const errorMessage = err.message.includes('可灵')
      ? err.message
      : '服务器内部错误，请稍后重试';

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
