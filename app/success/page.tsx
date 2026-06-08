/**
 * 支付成功页
 *
 * 路径: /success
 *
 * Creem 支付完成后跳转到此页面。
 * URL 参数: checkout_id, product_id（由 Creem 自动附加）
 *
 * 注意：实际的积分添加由 Webhook 处理，此页面仅做展示。
 */

import { Metadata } from 'next';
import { Suspense } from 'react';
import SuccessContent from './SuccessContent';

// ══════════════════════════════════════════════
// 安全头配置
// ══════════════════════════════════════════════

export const metadata: Metadata = {
  title: '支付成功 - What to Wear',
  // 防止搜索引擎索引此页面
  robots: {
    index: false,
    follow: false,
  },
};

// ══════════════════════════════════════════════
// 页面组件
// ══════════════════════════════════════════════

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
