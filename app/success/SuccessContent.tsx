/**
 * 支付成功页 - 客户端组件
 *
 * 功能：
 *   - 验证 URL 参数（checkout_id, product_id）
 *   - 防止直接访问（无参数时显示错误）
 *   - 5秒后自动跳转首页
 *   - 显示支付成功信息
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  // 获取 URL 参数
  const checkoutId = searchParams.get('checkout_id');
  const productId = searchParams.get('product_id');

  useEffect(() => {
    // ══════════════════════════════════════════════
    // 支付参数验证
    // ══════════════════════════════════════════════

    // 检查是否有必要的支付参数
    if (!checkoutId || !productId) {
      console.warn('[SuccessPage] 缺少支付参数:', { checkoutId, productId });
      setIsValid(false);
      return;
    }

    // 验证参数格式（Creem ID 格式：ch_xxx 和 prod_xxx）
    const isValidCheckoutId = /^ch_[a-zA-Z0-9]+$/.test(checkoutId);
    const isValidProductId = /^prod_[a-zA-Z0-9]+$/.test(productId);

    if (!isValidCheckoutId || !isValidProductId) {
      console.warn('[SuccessPage] 支付参数格式无效:', { checkoutId, productId });
      setIsValid(false);
      return;
    }

    setIsValid(true);

    // ══════════════════════════════════════════════
    // 自动跳转计时器
    // ══════════════════════════════════════════════
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [checkoutId, productId, router]);

  // ══════════════════════════════════════════════
  // 验证中状态
  // ══════════════════════════════════════════════
  if (isValid === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col items-center justify-center px-4">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        <p className="mt-4 text-sm text-slate-500">验证支付信息...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // 验证失败状态（直接访问或参数错误）
  // ══════════════════════════════════════════════
  if (isValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-4">
        {/* 警告图标 */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-100 rounded-full flex items-center justify-center mb-6 sm:mb-8 shadow-lg shadow-orange-100">
          <svg className="w-10 h-10 sm:w-12 sm:h-12 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center">
          访问无效
        </h1>

        <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-500 text-center max-w-sm">
          此页面需要在完成支付后访问。
          <br />
          如果你没有完成支付，请返回首页。
        </p>

        <button
          onClick={() => router.push('/')}
          className="mt-6 sm:mt-8 py-3 sm:py-3.5 px-8 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base text-white
            bg-indigo-600 hover:bg-indigo-700
            shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200
            transition-all active:scale-[0.98]"
        >
          返回首页
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // 验证成功状态
  // ══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col items-center justify-center px-4">
      {/* 成功图标 */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 sm:mb-8 shadow-lg shadow-green-100">
        <svg className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* 标题 */}
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center">
        支付成功！
      </h1>

      {/* 说明 */}
      <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-500 text-center max-w-sm">
        感谢你的购买！积分将在几秒内到账。
        <br />
        你可以开始使用 AI 虚拟试衣功能了。
      </p>

      {/* 订单信息卡片 */}
      <div className="mt-6 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 w-full max-w-xs sm:max-w-sm">
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-slate-500">订单号</span>
            <span className="font-mono text-slate-700 truncate max-w-[120px]" title={checkoutId || ''}>
              {checkoutId}
            </span>
          </div>
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-slate-500">产品</span>
            <span className="font-mono text-slate-700 truncate max-w-[120px]" title={productId || ''}>
              {productId}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-700">温馨提示</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                积分由服务器异步处理，如果几秒后仍未到账，请刷新页面查看。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-sm">
        <button
          onClick={() => router.push('/')}
          className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base text-white
            bg-indigo-600 hover:bg-indigo-700
            shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200
            transition-all active:scale-[0.98]"
        >
          开始试衣
        </button>
        <button
          onClick={() => router.push('/pricing')}
          className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-base text-slate-700
            bg-white border border-slate-200 hover:bg-slate-50
            transition-all active:scale-[0.98]"
        >
          查看方案
        </button>
      </div>

      {/* 自动跳转提示 */}
      <p className="mt-6 text-xs text-slate-400">
        {countdown > 0 ? `${countdown}秒后自动跳转到首页...` : '正在跳转...'}
      </p>
    </div>
  );
}
