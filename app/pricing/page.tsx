/**
 * /pricing 页面
 *
 * 展示积分包 + 订阅方案，根据新老用户展示不同产品
 * 点击购买跳转 Creem Checkout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  NEW_USER_PACK_10_ID,
  NEW_USER_PACK_100_ID,
  RETURNING_USER_PACK_10_ID,
  RETURNING_USER_PACK_100_ID,
  SUBSCRIPTION_MONTHLY_ID,
  PRODUCT_MAP,
  type ProductConfig,
} from '@/lib/creem';

// ══════════════════════════════════════════════
// 页面
// ══════════════════════════════════════════════

export default function PricingPage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);
  const [isReturningUser, setIsReturningUser] = useState<boolean | null>(null);
  const [checkingUser, setCheckingUser] = useState(false);

  // 使用延迟初始化避免构建时环境变量未注入的问题
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBrowserClient(supabaseUrl, supabaseKey);
  });

  // ── 获取当前用户状态 + 判断是否老用户 ──
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user ? { id: user.id, email: user.email } : null);

      if (user) {
        // 查询用户是否有购买记录
        setCheckingUser(true);
        try {
          const res = await fetch('/api/credits', {
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            // 通过实际购买记录判断是否老用户
            console.log('[Pricing] 用户购买记录查询结果:', { hasPurchaseRecord: data.hasPurchaseRecord, credits_balance: data.credits_balance });
            setIsReturningUser(!!data.hasPurchaseRecord);
          }
        } catch (e) {
          console.error('[Pricing] 查询用户购买记录失败:', e);
        } finally {
          setCheckingUser(false);
        }
      } else {
        setIsReturningUser(null);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // ── 全局购买锁定：任一按钮点击后禁用所有购买按钮 ──
  const isAnyLoading = loadingId !== null;

  const handlePurchase = async (productId: string) => {
    setLoadingId(productId);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('请先登录后再购买方案');
        router.push('/profile');
        return;
      }

      const res = await fetch('/api/creem/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      if (res.status === 401 || data.needLogin) {
        router.push('/profile');
        return;
      }

      if (!res.ok) {
        alert(data.error || '创建支付会话失败，请重试');
        return;
      }

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

  // 确定展示的产品
  const showReturningProducts = isReturningUser === true;
  const showNewUserProducts = isReturningUser === false || isReturningUser === null;

  // 积分包产品
  const newUserPacks: ProductConfig[] = [
    PRODUCT_MAP[NEW_USER_PACK_10_ID],
    PRODUCT_MAP[NEW_USER_PACK_100_ID],
  ].filter(Boolean);

  const returningUserPacks: ProductConfig[] = [
    PRODUCT_MAP[RETURNING_USER_PACK_10_ID],
    PRODUCT_MAP[RETURNING_USER_PACK_100_ID],
  ].filter(Boolean);

  // 订阅产品
  const subscriptionProduct = PRODUCT_MAP[SUBSCRIPTION_MONTHLY_ID];

  return (
    <div className="min-h-screen bg-[#FFF7FA]">
      {/* ── 导航栏 ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-900 hover:text-indigo-600 transition-colors"
          >
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-sm sm:text-base">What to Wear</span>
          </button>

          {currentUser && (
            <span className="text-xs text-slate-500">
              {currentUser.email}
            </span>
          )}
        </div>
      </nav>

      {/* ── 顶部 ── */}
      <header className="pt-8 sm:pt-12 pb-6 sm:pb-8 text-center px-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          选择你的方案
        </h1>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-500 max-w-xs sm:max-w-md mx-auto">
          {showReturningProducts
            ? '欢迎回来，选择适合你的积分包继续试衣'
            : '新用户首次购买积分包享额外赠送，用完再选方案也不迟'}
        </p>
        {!currentUser && (
          <p className="mt-2 text-xs text-amber-600">
            未登录用户默认展示新用户专享价格，登录后将根据购买记录自动切换
          </p>
        )}
        {checkingUser && (
          <p className="mt-2 text-xs text-slate-400">正在查询用户状态...</p>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12 sm:pb-20 space-y-12 sm:space-y-16">
        {/* ══════════════════════════════════
            积分包
        ══════════════════════════════════ */}
        <section>
          <div className="text-center mb-6 sm:mb-8">
            <span className="inline-block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
              {showReturningProducts ? '积分包' : '新用户专享'}
            </span>
            <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold text-slate-900">
              {showReturningProducts ? '按需购买，永久有效' : '首次购买享额外赠送'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            {(showReturningProducts ? returningUserPacks : newUserPacks).map((pack) => (
              <div
                key={pack.productId}
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
                  {pack.note && (
                    <p className="text-center text-[10px] sm:text-xs text-amber-600 font-medium mt-1">
                      {pack.note}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handlePurchase(pack.productId)}
                  disabled={isAnyLoading}
                  className="mt-3 sm:mt-4 w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all
                    bg-indigo-600 text-white hover:bg-indigo-700
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loadingId === pack.productId ? (
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="truncate">跳转支付中...</span>
                    </span>
                  ) : isAnyLoading ? (
                    '请稍候...'
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
        {subscriptionProduct && (
          <section>
            <div className="text-center mb-6 sm:mb-8">
              <span className="inline-block text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                订阅会员
              </span>
              <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold text-slate-900">无限畅穿，超值之选</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
              <div
                className="relative rounded-xl sm:rounded-2xl border-2 border-slate-200 bg-white p-4 sm:p-6 transition-all hover:shadow-lg"
              >
                <h3 className="text-base sm:text-lg font-bold text-slate-900">{subscriptionProduct.name}</h3>

                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="text-2xl sm:text-4xl font-extrabold text-slate-900">{subscriptionProduct.price}</span>
                  <span className="text-xs sm:text-sm text-slate-400">/月</span>
                </div>

                <p className="mt-1 text-xs sm:text-sm text-slate-500">{subscriptionProduct.perCredit}</p>

                <div className="mt-3 sm:mt-4 py-2 sm:py-3 border-t border-slate-100">
                  <p className="text-center text-xl sm:text-2xl font-bold text-amber-600">
                    {subscriptionProduct.credits}
                    <span className="text-xs sm:text-sm font-normal text-slate-500 ml-1">次/月</span>
                  </p>
                  {subscriptionProduct.note && (
                    <p className="text-center text-[10px] sm:text-xs text-amber-600 font-medium mt-1">
                      {subscriptionProduct.note}
                    </p>
                  )}
                </div>

                <ul className="mt-4 sm:mt-5 space-y-2 sm:space-y-2.5">
                  {subscriptionProduct.features?.map((f) => (
                    <li key={f} className="text-xs sm:text-sm text-slate-600 text-center">
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePurchase(subscriptionProduct.productId)}
                  disabled={isAnyLoading}
                  className="mt-5 sm:mt-6 w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all
                    bg-amber-500 text-white hover:bg-amber-600
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loadingId === subscriptionProduct.productId ? (
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="truncate">跳转支付中...</span>
                    </span>
                  ) : isAnyLoading ? (
                    '请稍候...'
                  ) : (
                    '开始订阅'
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── 底部操作 ── */}
        <div className="text-center space-y-3">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-xs sm:text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← 返回首页
            </button>
          </div>
          <p className="text-xs text-slate-400 pt-2">
            本应用虚拟试衣功能由可灵AI（Kling AI）提供技术支持 ·{' '}
            <a href="/terms" className="text-indigo-500 hover:text-indigo-600">Terms of Service</a> ·{' '}
            <a href="/privacy" className="text-indigo-500 hover:text-indigo-600">Privacy Policy</a>
          </p>
        </div>
      </main>
    </div>
  );
}
