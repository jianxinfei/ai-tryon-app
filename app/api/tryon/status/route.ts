/**
 * AI 虚拟试衣任务状态查询 API
 *
 * 路径: app/api/tryon/status/route.ts
 * 方法: POST
 *
 * 用于前端轮询查询可灵 AI 试衣任务的状态和结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// ══════════════════════════════════════════════
// 可灵 AI 配置
// ══════════════════════════════════════════════

const KLING_API_BASE = 'https://api-beijing.klingai.com';

// ══════════════════════════════════════════════
// 可灵 AI JWT Token 鉴权
// ══════════════════════════════════════════════

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateKlingJwtToken(ak: string, sk: string): string {
  const now = Math.floor(Date.now() / 1000);

  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify({
    iss: ak,
    exp: now + 1800,
    nbf: now - 5,
  }));

  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac('sha256', sk)
    .update(signingInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signature}`;
}

function getKlingAuthHeaders(): Record<string, string> {
  const ak = process.env.KLING_AI_ACCESS_KEY_ID;
  const sk = process.env.KLING_AI_SECRET_KEY;

  if (!ak || !sk) {
    console.error('[TryOn Status] 环境变量检查失败:', {
      hasAk: !!ak,
      hasSk: !!sk,
      envKeys: Object.keys(process.env).filter(k => k.startsWith('KLING_'))
    });
    throw new Error('可灵 AI 配置不完整，请联系管理员');
  }

  const token = generateKlingJwtToken(ak, sk);
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
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

    if (!taskId) {
      console.log('[TryOn Status] 参数错误：缺少 taskId');
      return NextResponse.json({
        success: false,
        error: '缺少任务ID',
      }, { status: 400 });
    }

    console.log('[TryOn Status] 查询任务状态:', taskId);

    // 构建查询 URL
    const url = `${KLING_API_BASE}/v1/images/kolors-virtual-try-on/${taskId}`;
    const headers = getKlingAuthHeaders();

    // 调用可灵 API，增加超时和错误处理
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000), // 15秒超时
      });
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
      const resultUrl = taskData.task_result?.images?.[0]?.url;

      if (!resultUrl) {
        console.error('[TryOn Status] 任务成功但无结果图片');
        return NextResponse.json({
          success: false,
          error: '任务成功但未获取到结果图片',
        });
      }

      console.log('[TryOn Status] 任务完成，结果 URL:', resultUrl);
      return NextResponse.json({
        success: true,
        resultUrl,
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
