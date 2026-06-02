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

function generateKlingJwtToken(): string {
  const ak = process.env.KLING_AI_ACCESS_KEY_ID;
  const sk = process.env.KLING_AI_SECRET_KEY;

  if (!ak || !sk) {
    throw new Error('[TryOn Status] 可灵 AI AK/SK 未配置');
  }

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
  const token = generateKlingJwtToken();
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

  try {
    // 解析请求体
    const body = await req.json().catch(() => ({}));
    const { taskId } = body;

    if (!taskId) {
      console.log('[TryOn Status] 参数错误：缺少 taskId');
      return NextResponse.json({
        success: false,
        error: '参数错误',
      }, { status: 400 });
    }

    console.log('[TryOn Status] 查询任务状态:', taskId);

    // 构建查询 URL
    const url = `${KLING_API_BASE}/v1/images/kolors-virtual-try-on/${taskId}`;
    const headers = getKlingAuthHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json();
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
    console.error('[TryOn Status] 查询失败:', err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
