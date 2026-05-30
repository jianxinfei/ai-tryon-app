/**
 * Creem Checkout API
 * 创建支付会话，跳转到 Creem 支付页面
 *
 * 路径: app/api/creem/checkout/route.ts
 * 方法: POST
 *
 * 安全特性：
 *   - 从 Supabase Auth 获取已登录用户的 user.id（不依赖前端传递）
 *   - 通过 Creem metadata 传递 userId，供 Webhook 回调时识别用户
 *
 * 请求体: { productId, productType? }
 *   - productId: Creem 产品 ID
 *   - productType: 'subscription' | 'one_time'（可选，用于 metadata）
 *
 * 响应: { checkoutUrl, checkoutId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getProductConfig } from '@/lib/creem';

export async function POST(req: NextRequest) {
  console.log('[Creem Checkout] === 开始处理请求 ===');

  try {
    // ── 1. 验证用户登录状态 ──
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component 中可能无法设置 cookie，忽略错误
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Creem Checkout] 用户未登录:', authError?.message);
      return NextResponse.json(
        { error: '请先登录后再购买', needLogin: true },
        { status: 401 }
      );
    }

    const userId = user.id;
    const customerEmail = user.email || '';

    console.log('[Creem Checkout] 已登录用户:', { userId, customerEmail });

    // ── 2. 解析请求体 ──
    let body;
    try {
      body = await req.json();
      console.log('[Creem Checkout] 请求体:', body);
    } catch (err) {
      console.error('[Creem Checkout] JSON 解析失败:', err);
      return NextResponse.json({ error: '无效的 JSON 请求体' }, { status: 400 });
    }

    const { productId, productType } = body;

    // ── 3. 验证必填参数 ──
    if (!productId) {
      console.error('[Creem Checkout] 错误: 缺少 productId');
      return NextResponse.json({ error: '缺少 productId' }, { status: 400 });
    }

    // ⚠️ 关键日志：记录接收到的 productId
    console.log('[Creem Checkout] 接收到的 productId:', productId);

    // ── 3.5. 获取产品配置，确定产品类型 ──
    const productConfig = getProductConfig(productId);
    const actualProductType = productType || productConfig?.type || 'unknown';

    console.log('[Creem Checkout] 产品配置:', productConfig ? '已找到' : '未找到', '| 类型:', actualProductType);

    // ── 4. 检查环境变量 ──
    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      console.error('[Creem Checkout] 缺少 CREEM_API_KEY');
      return NextResponse.json({ error: '服务器配置错误' }, { status: 500 });
    }

    const isTestMode = apiKey.startsWith('creem_test_');
    const baseUrl = isTestMode
      ? 'https://test-api.creem.io'
      : 'https://api.creem.io';

    console.log('[Creem Checkout] 环境:', isTestMode ? 'TEST' : 'PRODUCTION');
    console.log('[Creem Checkout] Base URL:', baseUrl);

    // ── 5. 构建回调 URL ──
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${appUrl}/success?checkout_id={CHECKOUT_ID}&product_id=${productId}`;

    console.log('[Creem Checkout] Success URL:', successUrl);
    console.log('[Creem Checkout] 即将传递给 Creem API 的 product_id:', productId);

    // ── 6. 调用 Creem REST API ──
    console.log('[Creem Checkout] 正在调用 Creem API...');
    console.log('[Creem Checkout] 请求体:', JSON.stringify({
      product_id: productId,
      success_url: successUrl,
      metadata: { userId, customerEmail, productType: actualProductType }
    }, null, 2));

    const response = await fetch(`${baseUrl}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: successUrl,
        // ⚠️ 关键：通过 metadata 传递 userId，Webhook 回调时用于识别用户
        metadata: {
          userId,           // Supabase Auth 用户 ID
          customerEmail,    // 用户邮箱
          productType: actualProductType, // 产品类型：subscription / credit_pack
        },
      }),
    });

    console.log('[Creem Checkout] API 响应状态:', response.status);

    // ── 7. 检查响应 ──
    const responseText = await response.text();
    console.log('[Creem Checkout] API 响应内容（前200字符）:', responseText.substring(0, 200));

    if (!response.ok) {
      console.error('[Creem Checkout] API 请求失败:', {
        status: response.status,
        body: responseText,
      });

      let errorMessage = `API 请求失败 (${response.status})`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = responseText || errorMessage;
      }

      return NextResponse.json(
        { error: '创建 Checkout 失败', detail: errorMessage },
        { status: 500 }
      );
    }

    // ── 8. 解析响应 ──
    if (!responseText) {
      console.error('[Creem Checkout] API 返回空响应');
      return NextResponse.json(
        { error: 'Creem API 返回了空响应' },
        { status: 500 }
      );
    }

    let checkoutData;
    try {
      checkoutData = JSON.parse(responseText);
    } catch (err) {
      console.error('[Creem Checkout] 响应 JSON 解析失败:', err);
      return NextResponse.json(
        { error: '响应格式错误', raw: responseText.substring(0, 100) },
        { status: 500 }
      );
    }

    console.log('[Creem Checkout] 创建成功:', {
      checkoutId: checkoutData.id,
      checkoutUrl: checkoutData.checkout_url || checkoutData.checkoutUrl,
    });

    // ── 9. 返回结果 ──
    return NextResponse.json({
      checkoutUrl: checkoutData.checkout_url || checkoutData.checkoutUrl,
      checkoutId: checkoutData.id,
    });

  } catch (err: any) {
    console.error('[Creem Checkout] 捕获到异常:');
    console.error('- 错误类型:', err.constructor?.name);
    console.error('- 错误消息:', err.message);
    console.error('- 错误堆栈:', err.stack);

    return NextResponse.json(
      { error: '服务器内部错误', message: err.message },
      { status: 500 }
    );
  }
}
