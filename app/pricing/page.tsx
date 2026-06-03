/**
 * /pricing 页面
 *
 * 展示积分包 + 订阅方案，点击购买跳转 Creem Checkout
 *
 * 响应式设计：
 *   - 手机 (< 640px): 单列布局，紧凑卡片
 *   - 平板 (640px - 1024px): 双列布局
 *   - 电脑 (> 1024px): 宽松双列布局
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// ══════════════════════════════════════════════
// 产品数据
// ══════════════════════════════════════════════
//
// ⚠️ 重要：确保这些 Product ID 与 Creem Dashboard 中的产品一致
// 积分包需要先在 Creem 创建后才能使用
//

// 你的 Creem 真实 Product ID
const CREEM_SUBSCRIPTION_PRODUCT_ID = 'prod_xWnfRXy7SUJHzhj4FrmgZ';

// 积分包（已启用）
const CREDIT_PACKS: Array<{
  id: string;
  name: string;
  credits: number;
  price: string;
  perCredit: string;
  highlight: boolean;
  badge?: string;
  disabled: boolean;
}> = [
  {
    id: 'prod_6MSm2Jfx384xKhS4YOe2zj', // 10次积分包
    name: '10次试穿积分包',
    credits: 10,
    price: '$1.99',
    perCredit: '$0.20/次',
    highlight: false,
    disabled: false, // 已启用
  },
  {
    id: 'prod_6AhvY6wWtpdDAEkPjxm7mf', // 100次积分包
    name: '100次试穿积分包',
    credits: 100,
    price: '$9.99',
    perCredit: '$0.10/次',
    highlight: true,
    badge: '最划算',
    disabled: false, // 已启用
  },
];

// 订阅方案（已配置真实 Product ID）
const SUBSCRIPTIONS: Array<{
  id: string;
  name: string;
  price: string;
  period: string;
  creditsPerMonth: number;
  features: string[];
  highlight: boolean;
  badge?: string;
}> = [
  {
    id: CREEM_SUBSCRIPTION_PRODUCT_ID,
    name: '月度专业版',
    price: '$9.90',
    period: '/月',
    creditsPerMonth: 100,
    features: ['每月100次试穿', '新品优先体验'],
    highlight: false,
  },
];

// ══════════════════════════════════════════════
// 页面
// ══════════════════════════════════════════════

export default function PricingPage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  // 使用延迟初始化避免构建时环境变量未注入的问题
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBrowserClient(supabaseUrl, supabaseKey);
  });

  // ── 获取当前用户状态 ──
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user ? { id: user.id, email: user.email } : null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── 登出 ──
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.push('/');
    router.refresh();
  };

  const handlePurchase = async (productId: string) => {
    setLoadingId(productId);
    try {
      // ── 检查用户是否登录 ──
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 未登录，提示用户并跳转到登录页
        alert('请先登录后再购买方案');
        router.push('/auth/login?redirectTo=/pricing');
        return;
      }

      // 已登录，创建支付会话（服务端会自动获取 user.id）
      const res = await fetch('/api/creem/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      // 未登录（服务端返回 401）
      if (res.status === 401 || data.needLogin) {
        router.push('/auth/login?redirectTo=/pricing');
        return;
      }

      // 其他错误
      if (!res.ok) {
        alert(data.error || '创建支付会话失败，请重试');
        return;
      }

      // 使用 API 返回的 checkoutUrl 直接跳转
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('未能获取支付链接，请重试');
      }
    } catch (err) {
      console.error('购买失败:', err);
      alert('网络错误，请重试');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* ── 导航栏 ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-900 hover:text-indigo-600 transition-colors"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-sm sm:text-base">AI Try-On</span>
          </button>

          {/* 登录/登出 */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 hidden sm:inline max-w-[100px] truncate" title={currentUser.email}>
                {currentUser.email}
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 py-1.5 hover:bg-slate-200 transition-colors text-xs font-semibold"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M3 12h12m0 0l-3-3m3 3l-3 3" />
                </svg>
                登出
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push('/auth/login?redirectTo=/pricing')}
              className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-full px-3 py-1.5 hover:bg-indigo-700 transition-colors text-xs font-semibold"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              登录
            </button>
          )}
        </div>
      </nav>

      {/* ── 顶部 ── */}
      <header className="pt-8 sm:pt-12 pb-6 sm:pb-8 text-center px-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          选择你的方案
        </h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-500 max-w-xs sm:max-w-md mx-auto">
          新用户注册即赠 <span className="font-semibold text-slate-700">3次免费试穿</span>，
          用完再选方案也不迟
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12 sm:pb-20 space-y-12 sm:space-y-16">
        {/* ══════════════════════════════════
            积分包
        ══════════════════════════════════ */}
        <section>
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
              积分包
            </span>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold text-slate-900">按需购买，永久有效</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`relative rounded-xl sm:rounded-2xl border-2 p-4 sm:p-6 transition-all hover:shadow-lg ${
                  pack.highlight
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-md'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {pack.badge && (
                  <span className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                    {pack.badge}
                  </span>
                )}

                <h3 className="text-base sm:text-lg font-bold text-slate-900">{pack.name}</h3>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="text-2xl sm:text-4xl font-extrabold text-slate-900">{pack.price}</span>
                  <span className="text-xs sm:text-sm text-slate-400">一次性</span>
                </div>

                <p className="mt-1 text-xs sm:text-sm text-slate-500">{pack.perCredit}</p>

                <div className="mt-3 sm:mt-4 py-2 sm:py-3 border-t border-slate-100">
                  <p className="text-center text-xl sm:text-2xl font-bold text-indigo-600">
                    {pack.credits}
                    <span className="text-xs sm:text-sm font-normal text-slate-500 ml-1">次试穿</span>
                  </p>
                </div>

                <button
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loadingId === pack.id}
                  className="mt-3 sm:mt-4 w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all
                    bg-indigo-600 text-white hover:bg-indigo-700
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingId === pack.id ? (
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="truncate">跳转支付中...</span>
                    </span>
                  ) : (
                    '立即购买'
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════
            订阅方案
        ══════════════════════════════════ */}
        <section>
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
              订阅会员
            </span>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold text-slate-900">无限畅穿，超值之选</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            {SUBSCRIPTIONS.map((sub) => (
              <div
                key={sub.id}
                className={`relative rounded-xl sm:rounded-2xl border-2 p-4 sm:p-6 transition-all hover:shadow-lg ${
                  sub.highlight
                    ? 'border-amber-400 bg-amber-50/30 shadow-md'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {sub.badge && (
                  <span className="absolute -top-2.5 sm:-top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                    {sub.badge}
                  </span>
                )}

                <h3 className="text-base sm:text-lg font-bold text-slate-900">{sub.name}</h3>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="text-2xl sm:text-4xl font-extrabold text-slate-900">{sub.price}</span>
                  <span className="text-xs sm:text-sm text-slate-400">{sub.period}</span>
                </div>

                <ul className="mt-4 sm:mt-5 space-y-2 sm:space-y-2.5">
                  {sub.features.map((f) => (
                    <li key={f} className="text-xs sm:text-sm text-slate-600 text-center">
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(sub.id)}
                  disabled={loadingId === sub.id}
                  className="mt-5 sm:mt-6 w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all
                    bg-amber-500 text-white hover:bg-amber-600
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingId === sub.id ? (
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="truncate">跳转支付中...</span>
                    </span>
                  ) : (
                    '开始订阅'
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── 底部操作 ── */}
        <div className="text-center space-y-3">
          <button
            onClick={() => router.push('/auth/login?redirectTo=/pricing')}
            className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            登录 / 注册以购买方案
          </button>
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-xs sm:text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← 返回首页
            </button>
          </div>
          <p className="text-xs text-slate-400 pt-2">
            本应用虚拟试衣功能由可灵AI（Kling AI）提供技术支持 · <a href="/terms" className="text-indigo-500 hover:text-indigo-600">用户协议</a>
          </p>
        </div>
      </main>
    </div>
  );
}
