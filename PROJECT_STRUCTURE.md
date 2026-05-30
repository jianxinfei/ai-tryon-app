# Next.js 项目结构

```
stripe-integration/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── checkout/
│   │   │   └── route.ts          # 创建 Checkout Session
│   │   ├── portal/
│   │   │   └── route.ts          # 创建 Customer Portal Session
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts      # Stripe Webhook 处理
│   ├── payment/
│   │   ├── success/
│   │   │   └── page.tsx          # 支付成功页面
│   │   └── cancel/
│   │       └── page.tsx          # 支付取消页面
│   ├── pricing/
│   │   └── page.tsx              # 定价页面
│   └── layout.tsx                # 根布局
├── components/
│   ├── PricingPage.tsx           # 定价组件
│   └── CreditBalance.tsx         # 积分余额组件
├── lib/
│   ├── stripe.ts                 # Stripe 工具函数
│   └── supabase.ts               # Supabase 客户端
├── .env.local                    # 环境变量（不提交）
├── .env.example                  # 环境变量示例
├── package.json
├── next.config.js
└── tsconfig.json
```

## 文件说明

### API 路由

| 路径 | 方法 | 用途 |
|------|------|------|
| `/api/checkout` | POST | 创建 Stripe Checkout Session |
| `/api/portal` | POST | 创建 Customer Portal Session |
| `/api/webhooks/stripe` | POST | 接收 Stripe Webhook |

### 页面

| 路径 | 用途 |
|------|------|
| `/pricing` | 定价页面，展示积分包和订阅选项 |
| `/payment/success` | 支付成功后的页面 |
| `/payment/cancel` | 支付取消后的页面 |
