/**
 * 可灵 AI 账户并发信息查询接口
 *
 * 路径: app/api/kling/concurrency/route.ts
 * 方法: GET
 *
 * 调用可灵账户信息接口，查询当前账户的并发上限。
 * 仅管理员可见（通过 ADMIN_PASSWORD 环境变量保护）。
 */

import { NextRequest, NextResponse } from 'next/server';

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
// GET 处理函数
// ══════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    // 管理员鉴权：通过 query 参数传入 admin_password
    const { searchParams } = new URL(request.url);
    const adminPassword = searchParams.get('admin_password');

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 调用可灵账户信息接口
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${KLING_API_BASE}/v1/account/info`, {
        method: 'GET',
        headers: getKlingAuthHeaders(),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[kling/concurrency] API error:', response.status, data);
        return NextResponse.json(
          {
            error: 'Failed to fetch account info',
            details: data.message || data.msg || 'Unknown error',
            code: data.code || null,
          },
          { status: response.status }
        );
      }

      // 返回账户并发信息
      return NextResponse.json({
        success: true,
        data: {
          // 可灵账户信息中的并发相关字段
          concurrency_limit: data.data?.concurrency_limit ?? data.data?.qps_limit ?? null,
          account_info: data.data || data,
          raw_response: data,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('[kling/concurrency] Unexpected error:', err);

    if (err.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request to Kling API timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
