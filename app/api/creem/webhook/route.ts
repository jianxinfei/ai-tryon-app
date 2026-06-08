/**
 * Creem Webhook 端点
 *
 * 路径: app/api/creem/webhook/route.ts
 *
 * 处理 Creem 官方 Webhook 事件:
 *   - checkout.completed       → 支付成功，添加积分
 *   - subscription.paid        → 订阅续费成功，添加积分
 *
 * 积分表: public.user_credits
 * 积分列: credits
 *
 * 事件结构参考: https://docs.creem.io/code/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getProductConfig } from '@/lib/creem';

// ══════════════════════════════════════════════
// Supabase 客户端（延迟初始化）
// ══════════════════════════════════════════════

let _supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('缺少 Supabase 环境变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    }

    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

// ══════════════════════════════════════════════
// Webhook 处理
// ══════════════════════════════════════════════

export async function POST(req: NextRequest) {
  console.log('[Creem Webhook] === 收到请求 ===');

  try {
    const payload = await req.text();
    const signature = req.headers.get('creem-signature') || '';

    console.log('[Creem Webhook] Payload 长度:', payload.length);
    console.log('[Creem Webhook] Signature:', signature ? `${signature.substring(0, 20)}...` : '缺失');

    // ── 1. 验证签名 ──
    const secret = process.env.CREEM_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Creem Webhook] 错误: 缺少 CREEM_WEBHOOK_SECRET 环境变量');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!signature) {
      console.error('[Creem Webhook] 错误: 缺少 creem-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 验证签名
    const computed = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    console.log('[Creem Webhook] 计算签名:', computed.substring(0, 20) + '...');

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))) {
        console.error('[Creem Webhook] 错误: 签名不匹配');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch (err) {
      console.error('[Creem Webhook] 签名比较异常:', err);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    console.log('[Creem Webhook] 签名验证通过 ✓');

    // ── 2. 解析事件 ──
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch (err) {
      console.error('[Creem Webhook] 错误: JSON 解析失败');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = event.eventType;
    const eventId = event.id;

    console.log(`[Creem Webhook] 事件类型: ${eventType} | 事件ID: ${eventId}`);

    // ── 3. 分发处理 ──
    switch (eventType) {
      case 'checkout.completed':
        await handleCheckoutCompleted(event);
        break;

      case 'subscription.paid':
        await handleSubscriptionPaid(event);
        break;

      case 'subscription.active':
      case 'subscription.canceled':
      case 'subscription.past_due':
        console.log(`[Creem Webhook] 事件 ${eventType} 已收到，暂不处理`);
        break;

      default:
        console.log(`[Creem Webhook] 未处理的事件类型: ${eventType}`);
    }

    console.log('[Creem Webhook] === 处理完成 ===');
    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error('[Creem Webhook] 捕获异常:');
    console.error('- 类型:', err.constructor?.name);
    console.error('- 消息:', err.message);
    console.error('- 堆栈:', err.stack);

    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════
// 事件处理器
// ══════════════════════════════════════════════

/**
 * checkout.completed - 支付完成
 * 
 * 处理两种情况：
 * 1. 一次性支付（积分包）- 直接添加积分
 * 2. 订阅首次支付 - 添加首月积分
 */
async function handleCheckoutCompleted(event: any) {
  const data = event.object;
  const productId = data.product?.id;
  const customerEmail = data.customer?.email;
  const orderAmount = data.order?.amount;
  const orderType = data.order?.type; // 'one_time' | 'recurring'

  // 从 metadata 获取 userId 和 productType
  const userId = data.metadata?.userId;
  const productType = data.metadata?.productType;

  console.log('[Creem Webhook] checkout.completed 详情:');
  console.log('  - productId:', productId);
  console.log('  - userId (from metadata):', userId);
  console.log('  - customerEmail:', customerEmail);
  console.log('  - orderAmount:', orderAmount);
  console.log('  - orderType:', orderType, orderType === 'one_time' ? '(一次性支付)' : '(订阅)');
  console.log('  - productType (from metadata):', productType);

  if (!userId) {
    console.warn('[Creem Webhook] 警告: metadata 中缺少 userId，无法添加积分');
    return;
  }

  if (!productId) {
    console.warn('[Creem Webhook] 警告: 缺少 productId');
    return;
  }

  const product = getProductConfig(productId);
  if (!product) {
    console.warn(`[Creem Webhook] 警告: 未知的 productId: ${productId}，请在 lib/creem.ts 的 PRODUCT_MAP 中配置`);
    return;
  }

  // 判断是否为一次性支付（积分包）
  const isOneTimePayment = orderType === 'one_time' || product.type === 'credit_pack';
  
  console.log(`[Creem Webhook] 产品类型: ${product.type}, 是否一次性: ${isOneTimePayment}`);

  // 根据 Product ID 直接发放对应积分（新老用户产品已在 Creem 端分离）
  const creditsToAdd = product.credits;
  const description = isOneTimePayment
    ? `购买 ${product.name} (${creditsToAdd}次)`
    : `订阅 ${product.name} - 首月积分 (${creditsToAdd}次)`;

  console.log(`[Creem Webhook] 开始添加积分: userId=${userId}, productId=${productId}, amount=${creditsToAdd}`);

  const result = await addCreditsToUser({
    userId,
    amount: creditsToAdd,
    transactionType: 'purchase',
    description,
    paymentReference: data.order?.id,
    paymentAmountCents: orderAmount,
  });

  if (result.success) {
    console.log(`[Creem Webhook] 积分添加成功 ✓ userId=${userId}, 新余额=${result.newBalance}`);
  } else {
    console.error(`[Creem Webhook] 积分添加失败 ✗ userId=${userId}, 错误=${result.error}`);
  }
}

/**
 * subscription.paid - 订阅续费成功
 */
async function handleSubscriptionPaid(event: any) {
  const data = event.object;
  const productId = data.product?.id;
  const userId = data.metadata?.userId;

  console.log(`[Creem Webhook] subscription.paid | userId=${userId} | productId=${productId}`);

  if (!userId || !productId) return;

  const product = getProductConfig(productId);
  if (!product) return;

  // 续费添加积分（订阅固定每月 110 次）
  const subscriptionCredits = 110;
  const result = await addCreditsToUser({
    userId,
    amount: subscriptionCredits,
    transactionType: 'purchase',
    description: `订阅 ${product.name} - 续费积分 (${subscriptionCredits}次)`,
    paymentReference: data.last_transaction_id,
  });

  if (result.success) {
    console.log(`[Creem Webhook] 续费积分添加成功 ✓ userId=${userId}, 新余额=${result.newBalance}`);
  }
}

// ══════════════════════════════════════════════
// 积分操作
// ══════════════════════════════════════════════

/**
 * 为用户添加积分
 *
 * 表: public.user_credits
 * 列: credits (积分余额)
 */
async function addCreditsToUser(params: {
  userId: string;
  amount: number;
  transactionType: 'purchase' | 'bonus' | 'refund';
  description: string;
  paymentReference?: string;
  paymentAmountCents?: number;
}): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const { userId, amount, transactionType, description, paymentReference, paymentAmountCents } = params;

  try {
    const supabase = getSupabaseAdmin();

    // 1. 查询当前积分记录
    const { data: current, error: fetchError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    const isNotFound = fetchError?.code === 'PGRST116'; // 记录不存在
    if (fetchError && !isNotFound) {
      console.error('[addCredits] 查询积分失败:', fetchError);
      return { success: false, newBalance: 0, error: fetchError.message };
    }

    // 2. 计算新余额
    const currentBalance = current?.credits ?? 0;
    const newBalance = currentBalance + amount;

    console.log(`[addCredits] 当前余额=${currentBalance}, 增加=${amount}, 新余额=${newBalance}`);

    // 3. 更新或创建积分记录
    if (isNotFound || !current) {
      // 记录不存在，创建新记录
      console.log('[addCredits] 用户积分记录不存在，创建新记录...');

      const { error: insertError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits: amount,  // 积分列名是 credits
        });

      if (insertError) {
        console.error('[addCredits] 创建积分记录失败:', insertError);
        return { success: false, newBalance: 0, error: insertError.message };
      }

      console.log('[addCredits] 创建积分记录成功 ✓');
    } else {
      // 记录存在，更新积分
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          credits: newBalance,  // 积分列名是 credits
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[addCredits] 更新积分失败:', updateError);
        return { success: false, newBalance: 0, error: updateError.message };
      }

      console.log('[addCredits] 更新积分成功 ✓');
    }

    // 4. 记录交易流水（可选，失败不影响主流程）
    try {
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          transaction_type: transactionType,
          amount: amount,
          balance_after: newBalance,
          description: description,
          stripe_payment_intent_id: paymentReference ?? null,
          payment_amount_cents: paymentAmountCents ?? null,
          payment_currency: 'USD',
        });
    } catch (txError) {
      console.warn('[addCredits] 记录交易流水失败（不影响主流程）:', txError);
    }

    return { success: true, newBalance };

  } catch (err: any) {
    console.error('[addCredits] 异常:', err);
    return { success: false, newBalance: 0, error: err.message };
  }
}
