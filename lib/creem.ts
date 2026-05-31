/**
 * Creem 支付客户端
 * 使用官方 TypeScript SDK
 *
 * API 文档: https://docs.creem.io
 * SDK: npm install creem_io
 */

import { createCreem } from 'creem_io';

// ══════════════════════════════════════════════
// Creem 客户端初始化（延迟初始化）
// ══════════════════════════════════════════════

let _creemClient: ReturnType<typeof createCreem> | null = null;

/**
 * 获取 Creem 客户端（延迟初始化）
 * 避免在构建阶段因环境变量未注入而失败
 */
export function getCreemClient(): ReturnType<typeof createCreem> {
  if (!_creemClient) {
    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) {
      throw new Error('CREEM_API_KEY 环境变量未配置');
    }
    _creemClient = createCreem({
      apiKey,
      testMode: apiKey.startsWith('creem_test_'),
    });
  }
  return _creemClient;
}

// 兼容旧代码的导出（延迟获取）
export const creem = new Proxy({} as ReturnType<typeof createCreem>, {
  get(_target, prop) {
    return Reflect.get(getCreemClient(), prop);
  },
});

// ══════════════════════════════════════════════
// 产品配置
// ══════════════════════════════════════════════

export interface ProductConfig {
  credits: number;
  name: string;
  productId: string;  // Creem Product ID (prod_xxx)
  type: 'credit_pack' | 'subscription';
  billingPeriod?: 'every-month' | 'every-year';
  features?: string[];
}

/**
 * Product ID → 产品配置映射
 *
 * ⚠️ 需要在 Creem Dashboard 创建产品后，将 Product ID 填入此处
 * 当前已配置: prod_xWnfRXy7SUJHzhj4FrmgZ
 */
export const PRODUCT_MAP: Record<string, ProductConfig> = {
  // ── 积分包（一次性购买） ──
  // 10次积分包 - $1.99
  'prod_6MSm2Jfx384xKhS4YOe2zj': {
    credits: 10,
    name: '10次试穿积分包',
    productId: 'prod_6MSm2Jfx384xKhS4YOe2zj',
    type: 'credit_pack',
  },
  // 100次积分包 - $9.99
  'prod_6AhvY6wWtpdDAEkPjxm7mf': {
    credits: 100,
    name: '100次试穿积分包',
    productId: 'prod_6AhvY6wWtpdDAEkPjxm7mf',
    type: 'credit_pack',
  },

  // ── 订阅制 ──
  // 月度订阅 - $9.90/月
  'prod_xWnfRXy7SUJHzhj4FrmgZ': {
    credits: 100, // 每月赠送的积分
    name: 'AI Try-On 订阅',
    productId: 'prod_xWnfRXy7SUJHzhj4FrmgZ',
    type: 'subscription',
    billingPeriod: 'every-month',
    features: ['每月100次试穿', '高清无水印', '新品优先体验'],
  },
};

// 便捷导出：积分包 Product ID
export const CREDIT_PACK_10_ID = 'prod_6MSm2Jfx384xKhS4YOe2zj';
export const CREDIT_PACK_100_ID = 'prod_6AhvY6wWtpdDAEkPjxm7mf';
export const SUBSCRIPTION_MONTHLY_ID = 'prod_xWnfRXy7SUJHzhj4FrmgZ';

/**
 * 根据 Product ID 获取产品配置
 */
export function getProductConfig(productId: string): ProductConfig | null {
  return PRODUCT_MAP[productId] ?? null;
}

// ══════════════════════════════════════════════
// Checkout 会话
// ══════════════════════════════════════════════

export interface CreateCheckoutParams {
  productId: string;
  successUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * 创建 Creem Checkout 会话
 *
 * 调用后返回 checkout_url，前端跳转到该 URL 完成支付
 *
 * 注意：Creem SDK 目前不支持 cancelUrl 参数，只支持 successUrl
 */
export async function createCheckoutSession(params: CreateCheckoutParams) {
  const { productId, successUrl, metadata } = params;

  console.log('[createCheckoutSession] 调用 SDK:', { productId, successUrl, metadata });

  try {
    const checkout = await creem.checkouts.create({
      productId,
      successUrl,
      metadata,
    });

    console.log('[createCheckoutSession] SDK 返回:', checkout);

    return {
      id: checkout.id,
      checkoutUrl: checkout.checkoutUrl,
    };
  } catch (err: any) {
    console.error('[createCheckoutSession] SDK 调用失败:', err);
    throw err;
  }
}

// ══════════════════════════════════════════════
// Webhook 签名验证
// ══════════════════════════════════════════════

import crypto from 'crypto';

/**
 * 验证 Creem Webhook 签名
 *
 * Creem 使用 HMAC-SHA256 算法：
 * - key: CREEM_WEBHOOK_SECRET
 * - message: 请求 body 原始字符串
 * - signature 在 creem-signature header 中
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed),
  );
}

// ══════════════════════════════════════════════
// Webhook 事件类型（基于官方文档）
// ══════════════════════════════════════════════

/**
 * Creem Webhook 事件类型
 * 参考: https://docs.creem.io/code/webhooks
 */
export type CreemEventType =
  | 'checkout.completed'
  | 'subscription.active'
  | 'subscription.paid'
  | 'subscription.canceled'
  | 'subscription.scheduled_cancel'
  | 'subscription.past_due'
  | 'subscription.expired'
  | 'subscription.update'
  | 'subscription.trialing'
  | 'subscription.paused'
  | 'refund.created'
  | 'dispute.created';

/**
 * Creem Webhook 事件结构
 */
export interface CreemWebhookEvent {
  id: string;                    // 事件 ID (evt_xxx)
  eventType: CreemEventType;     // 事件类型
  created_at: number;            // 时间戳（毫秒）
  object: CreemWebhookObject;    // 事件数据
}

/**
 * Webhook 事件数据对象
 * 不同事件类型的数据结构略有不同，这里取公共字段
 */
export interface CreemWebhookObject {
  id: string;
  object: string;

  // 订单信息（checkout.completed 事件包含）
  order?: {
    id: string;
    customer: string;
    product: string;
    amount: number;
    currency: string;
    status: string;
    type: 'one_time' | 'recurring';
    created_at: string;
    updated_at: string;
    mode: string;
  };

  // 产品信息
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    billing_type: 'one_time' | 'recurring';
    billing_period: string;
    status: string;
  };

  // 客户信息
  customer?: {
    id: string;
    email: string;
    name: string;
    country: string;
  };

  // 订阅信息
  subscription?: {
    id: string;
    product: string;
    customer: string;
    status: string;
    collection_method: string;
    current_period_start_date?: string;
    current_period_end_date?: string;
    last_transaction_date?: string;
    next_transaction_date?: string;
    canceled_at: string | null;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, any>;
  };

  // Checkout 信息（checkout.completed 事件包含）
  status?: string;
  metadata?: Record<string, any>;
  mode?: string;
}
