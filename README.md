# Stripe + Supabase 集成指南

## 概述

本文档说明如何集成 Stripe 支付系统，实现：
- 积分购买（一次性支付）
- 订阅管理（月付/季付/年付）
- Webhook 自动更新 Supabase 数据

---

## 架构流程

```
用户点击购买
     │
     ▼
┌─────────────────┐
│  /api/checkout  │  创建 Stripe Checkout Session
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Stripe Checkout │  用户输入支付信息
└────────┬────────┘
         │
         ▼
   支付成功
         │
         ▼
┌─────────────────────────┐
│  Stripe Webhook         │  发送事件通知
│  checkout.session.completed
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  /api/webhooks/stripe   │  接收并处理事件
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Supabase               │  更新积分/订阅数据
│  - user_credits         │
│  - subscriptions        │
│  - credit_transactions  │
└─────────────────────────┘
```

---

## 第一步：Stripe Dashboard 配置

### 1. 创建产品和价格

在 [Stripe Dashboard](https://dashboard.stripe.com/products) 创建以下产品：

**积分包产品：**

| 产品名称 | 价格 | Price ID |
|----------|------|----------|
| 基础积分包 | $2.99 | `price_credits_20` |
| 标准积分包 | $6.99 | `price_credits_50` |
| 高级积分包 | $9.99 | `price_credits_100` |
| 专业积分包 | $16.99 | `price_credits_200` |

**订阅产品：**

| 产品名称 | 价格 | Price ID |
|----------|------|----------|
| 月度订阅 | $14.99/月 | `price_monthly` |
| 季度订阅 | $39.99/季 | `price_quarterly` |
| 年度订阅 | $99.99/年 | `price_yearly` |

### 2. 获取 API 密钥

在 [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/developers) 获取：
- `STRIPE_SECRET_KEY` (Secret key)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Publishable key)

### 3. 创建 Webhook 端点

在 [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/developers/webhooks) 创建：

**开发环境：**
- 端点 URL: 使用 Stripe CLI（见下文）
- 监听事件:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`

**生产环境：**
- 端点 URL: `https://your-domain.com/api/webhooks/stripe`
- 同样监听上述事件

### 4. 配置 Customer Portal

在 [Stripe Dashboard > Settings > Billing > Customer portal](https://dashboard.stripe.com/settings/billing/portal) 启用客户门户，允许用户：
- 取消订阅
- 更新支付方式
- 查看发票历史

---

## 第二步：环境变量配置

创建 `.env.local` 文件：

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**重要：** `SUPABASE_SERVICE_ROLE_KEY` 是必须的，因为 Webhook 需要绕过 RLS 写入数据。

---

## 第三步：本地开发配置

### 使用 Stripe CLI 测试 Webhook

```bash
# 安装 Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
#          scoop install stripe

# 登录 Stripe
stripe login

# 转发 Webhook 到本地
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 这会输出一个 webhook secret，复制到 STRIPE_WEBHOOK_SECRET
```

### 测试支付

使用 Stripe 测试卡号：
- 成功: `4242 4242 4242 4242`
- 失败: `4000 0000 0000 0002`
- 需要 3D 验证: `4000 0025 0000 3155`

---

## 第四步：部署到 Vercel

### 1. 部署项目

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### 2. 配置环境变量

在 Vercel Dashboard > Settings > Environment Variables 添加所有环境变量。

### 3. 更新 Stripe Webhook

将生产环境的 Webhook URL 更新为：
```
https://your-app.vercel.app/api/webhooks/stripe
```

---

## API 端点说明

### POST /api/checkout

创建 Stripe Checkout Session。

**请求：**
```json
{
  "priceId": "price_credits_100",
  "userId": "user-uuid",
  "mode": "payment"  // 或 "subscription"
}
```

**响应：**
```json
{
  "sessionId": "cs_xxxxx",
  "url": "https://checkout.stripe.com/xxxxx"
}
```

---

### POST /api/webhooks/stripe

接收 Stripe Webhook 事件。

**处理的事件：**

| 事件 | 处理逻辑 |
|------|----------|
| `checkout.session.completed` | 积分购买成功，添加积分 |
| `payment_intent.succeeded` | 备用：支付成功 |
| `customer.subscription.created` | 创建订阅记录 |
| `customer.subscription.updated` | 更新订阅状态 |
| `customer.subscription.deleted` | 标记订阅取消 |
| `invoice.paid` | 订阅续费成功 |

---

### POST /api/portal

创建 Customer Portal Session。

**请求：**
```json
{
  "customerId": "cus_xxxxx"
}
```

**响应：**
```json
{
  "url": "https://billing.stripe.com/xxxxx"
}
```

---

## 数据更新逻辑

### 积分购买流程

```
1. 用户选择积分包，点击购买
2. 调用 /api/checkout 创建 Checkout Session
3. 跳转到 Stripe Checkout 页面
4. 用户完成支付
5. Stripe 发送 checkout.session.completed 事件
6. Webhook 接收事件，调用 Supabase RPC:
   - add_credits() 添加积分
   - 记录 credit_transactions
7. 用户被重定向到成功页面
```

### 订阅流程

```
1. 用户选择订阅计划，点击订阅
2. 调用 /api/checkout (mode=subscription)
3. 跳转到 Stripe Checkout
4. 用户完成支付
5. Stripe 发送 customer.subscription.created 事件
6. Webhook 在 subscriptions 表创建记录
7. 订阅续费时，Stripe 发送 invoice.paid 事件
8. Webhook 更新订阅状态
```

---

## 前端集成

### 在 Flutter 中集成

```dart
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:http/http.dart' as http;

// 初始化 Stripe
await Stripe.instance.applySettings();

// 创建 Checkout Session
final response = await http.post(
  Uri.parse('https://your-api.com/api/checkout'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'priceId': 'price_credits_100',
    'userId': userId,
    'mode': 'payment',
  }),
);

final data = jsonDecode(response.body);

// 跳转到 Stripe Checkout（使用 webview 或外部浏览器）
launchUrl(Uri.parse(data['url']));
```

---

## 安全注意事项

1. **Webhook 签名验证** - 必须验证 `stripe-signature` 头，防止伪造请求
2. **Service Role Key** - Webhook 需要使用 `service_role` key，不要暴露到前端
3. **幂等处理** - 同一事件可能重复发送，需要处理幂等性
4. **错误日志** - 记录所有错误，便于排查问题

---

## 测试清单

- [ ] 积分购买成功后，Supabase 中积分增加
- [ ] credit_transactions 表有正确的交易记录
- [ ] 订阅创建后，subscriptions 表有记录
- [ ] 订阅取消后，状态正确更新
- [ ] 订阅续费后，周期时间正确更新
- [ ] Webhook 签名验证正常工作
- [ ] 错误情况有正确的日志记录

---

## 常见问题

### Q: Webhook 没有收到事件？

检查：
1. Webhook URL 是否正确
2. 是否监听了正确的事件类型
3. 本地开发是否使用了 Stripe CLI 转发

### Q: 积分没有增加？

检查：
1. `SUPABASE_SERVICE_ROLE_KEY` 是否正确
2. Supabase RPC 函数 `add_credits` 是否存在
3. 查看 Vercel 函数日志

### Q: 订阅状态不正确？

检查：
1. `subscriptions` 表的约束是否正确
2. Webhook 是否正确处理了所有订阅事件
