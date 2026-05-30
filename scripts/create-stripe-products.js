/**
 * Stripe 产品和价格初始化脚本
 *
 * 用途：在 Stripe 后台创建 AI试衣App 的所有产品和价格
 * 运行方式：node scripts/create-stripe-products.js
 *
 * ⚠️ 运行前请确保：
 * 1. 已安装依赖：npm install stripe
 * 2. 已设置环境变量：STRIPE_SECRET_KEY
 */

const Stripe = require('stripe');

// ── 从环境变量读取密钥 ──
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// ══════════════════════════════════════════════
// 产品定义
// ══════════════════════════════════════════════

const PRODUCTS = [
  {
    // ── 1. 10次试穿积分包 ──
    name: '10次试穿积分包',
    description: '一次性购买10次AI虚拟试衣机会，永久有效',
    type: 'one_time',
    price: {
      unit_amount: 199, // $1.99 = 199 cents
      currency: 'usd',
      metadata: {
        credits: '10',
        type: 'credit_pack',
      },
    },
    metadata: {
      credits: '10',
      type: 'credit_pack',
    },
  },
  {
    // ── 2. 100次试穿积分包 ──
    name: '100次试穿积分包',
    description: '一次性购买100次AI虚拟试衣机会，永久有效',
    type: 'one_time',
    price: {
      unit_amount: 999, // $9.99 = 999 cents
      currency: 'usd',
      metadata: {
        credits: '100',
        type: 'credit_pack',
      },
    },
    metadata: {
      credits: '100',
      type: 'credit_pack',
    },
  },
  {
    // ── 3. 月度专业版 ──
    name: '月度专业版',
    description: '每月100次AI虚拟试衣，高清无水印，新品优先体验',
    type: 'recurring',
    recurring: {
      interval: 'month',
      interval_count: 1,
      trial_period_days: 0,
      usage_type: 'licensed', // licensed = 固定配额，metered = 按量计费
    },
    price: {
      unit_amount: 999, // $9.99/month
      currency: 'usd',
      metadata: {
        credits_per_month: '100',
        type: 'subscription',
        features: 'hd,no_watermark,early_access',
      },
    },
    metadata: {
      credits_per_month: '100',
      type: 'subscription',
      features: 'hd,no_watermark,early_access',
    },
  },
  {
    // ── 4. 年度专业版 ──
    name: '年度专业版',
    description: '每年1200次AI虚拟试衣（每月100次），高清无水印，新品优先体验，相当于66折',
    type: 'recurring',
    recurring: {
      interval: 'year',
      interval_count: 1,
      trial_period_days: 0,
      usage_type: 'licensed',
    },
    price: {
      unit_amount: 7999, // $79.99/year
      currency: 'usd',
      metadata: {
        credits_per_month: '100',
        credits_per_year: '1200',
        type: 'subscription',
        discount: '34%',
        features: 'hd,no_watermark,early_access',
      },
    },
    metadata: {
      credits_per_month: '100',
      credits_per_year: '1200',
      type: 'subscription',
      discount: '34%',
      features: 'hd,no_watermark,early_access',
    },
  },
];

// ══════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════

async function createProducts() {
  console.log('═══════════════════════════════════════');
  console.log('  Stripe 产品和价格创建脚本');
  console.log('═══════════════════════════════════════\n');

  const results = [];

  for (const productDef of PRODUCTS) {
    try {
      console.log(`📦 创建产品: ${productDef.name} ...`);

      // ── 第1步：创建产品 ──
      const product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
        metadata: productDef.metadata,
      });

      // ── 第2步：创建价格 ──
      const priceParams = {
        product: product.id,
        unit_amount: productDef.price.unit_amount,
        currency: productDef.price.currency,
        metadata: productDef.price.metadata,
      };

      // 订阅产品需要额外参数
      if (productDef.type === 'recurring') {
        priceParams.recurring = productDef.recurring;
      }

      // 一次性产品标记为 one-time
      if (productDef.type === 'one_time') {
        // Stripe 默认就是 one-time，无需额外设置
      }

      const price = await stripe.prices.create(priceParams);

      console.log(`   ✅ 产品ID: ${product.id}`);
      console.log(`   ✅ 价格ID: ${price.id}`);
      console.log(`   ✅ 价格: $${(price.unit_amount / 100).toFixed(2)}`);
      if (price.recurring) {
        console.log(`   ✅ 周期: 每${price.recurring.interval_count} ${price.recurring.interval}`);
      }
      console.log('');

      results.push({
        name: productDef.name,
        type: productDef.type,
        productId: product.id,
        priceId: price.id,
        price: `$${(price.unit_amount / 100).toFixed(2)}`,
        recurring: price.recurring
          ? `每${price.recurring.interval_count} ${price.recurring.interval}`
          : '一次性',
      });
    } catch (error) {
      console.error(`   ❌ 创建失败: ${error.message}\n`);
      results.push({
        name: productDef.name,
        error: error.message,
      });
    }
  }

  // ── 输出汇总 ──
  console.log('═══════════════════════════════════════');
  console.log('  创建结果汇总');
  console.log('═══════════════════════════════════════\n');

  console.table(results);

  // ── 输出 Price ID 映射（复制到代码中使用） ──
  console.log('\n═══════════════════════════════════════');
  console.log('  Price ID 映射（复制到代码中）');
  console.log('═══════════════════════════════════════\n');

  const successResults = results.filter((r) => !r.error);
  for (const r of successResults) {
    const key = r.name
      .replace(/次试穿积分包/, '_CREDITS')
      .replace(/月度专业版/, 'SUBSCRIPTION_MONTHLY')
      .replace(/年度专业版/, 'SUBSCRIPTION_YEARLY')
      .toUpperCase();

    console.log(`  ${key} = '${r.priceId}'`);
  }

  // ── 输出 JSON（方便程序读取） ──
  console.log('\n═══════════════════════════════════════');
  console.log('  JSON 格式输出');
  console.log('═══════════════════════════════════════\n');

  const jsonOutput = {};
  for (const r of successResults) {
    const key = r.type === 'one_time'
      ? `price_credits_${r.metadata?.credits || ''}`
      : r.name.includes('月度')
        ? 'price_monthly'
        : 'price_yearly';
    jsonOutput[key] = r.priceId;
  }
  console.log(JSON.stringify(jsonOutput, null, 2));

  return results;
}

// ── 执行 ──
createProducts()
  .then((results) => {
    const successCount = results.filter((r) => !r.error).length;
    const failCount = results.filter((r) => r.error).length;
    console.log(`\n✅ 完成: ${successCount} 成功, ${failCount} 失败`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行出错:', error);
    process.exit(1);
  });
