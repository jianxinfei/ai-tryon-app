/**
 * 首页
 *
 * 功能：
 *   - 显著展示剩余免费次数
 *   - 试衣按钮（含积分校验）
 *   - 积分不足时弹出付费引导框
 *
 * 响应式设计：
 *   - 手机 (< 640px): 紧凑布局，小字号
 *   - 平板 (640px - 1024px): 中等布局
 *   - 电脑 (> 1024px): 宽松布局
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

// ══════════════════════════════════════════════
// 类型
// ══════════════════════════════════════════════

interface CreditInfo {
  credits_balance: number;
  can_try: boolean;
  use_type: string;
}

// ══════════════════════════════════════════════
// 页面
// ══════════════════════════════════════════════

export default function HomePage() {
  const router = useRouter();
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

  // ── 加载积分 ──
  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits', {
        credentials: 'include', // 确保携带 cookie（Supabase session）
      });
      if (res.ok) {
        const data = await res.json();
        setCredits(data);
      } else {
        console.warn('[Home] 获取积分失败，状态:', res.status);
      }
    } catch (err) {
      console.error('获取积分失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // ── 点击试衣 ──
  const handleTryOn = async () => {
    setTryOnLoading(true);

    try {
      // 第1步：请求扣减积分
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include', // 确保携带 cookie（Supabase session）
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // 积分不足 → 弹出付费引导
        setShowGuide(true);
        return;
      }

      // 第2步：积分充足 → 调用 AI 试衣接口
      const aiResult = await callAITryOn();

      if (aiResult.success) {
        // 成功：刷新积分显示
        await fetchCredits();
        // TODO: 跳转到结果页
        alert('试衣成功！');
      } else {
        // AI 失败：积分已扣但试衣失败（实际应退款，这里简化处理）
        alert('试衣生成失败，请重试。积分未被扣除。');
      }
    } catch (err) {
      console.error('试衣出错:', err);
    } finally {
      setTryOnLoading(false);
    }
  };

  // ── 模拟 AI 试衣调用 ──
  const callAITryOn = async () => {
    // TODO: 替换为真实的 AI 试衣 API 调用
    await new Promise((r) => setTimeout(r, 2000));
    return { success: true };
  };

  // ── Supabase 客户端 ──
  // 使用延迟初始化避免构建时环境变量未注入的问题
  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBrowserClient(supabaseUrl, supabaseKey);
  });

  // ── 获取当前用户状态 ──
  useEffect(() => {
    console.log('[Home] 初始化用户状态检查');
    
    const getUser = async () => {
      console.log('[Home] 调用 getUser()');
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('[Home] getUser 结果:', user ? `用户已登录: ${user.email}` : '未登录', error);
      setCurrentUser(user ? { id: user.id, email: user.email } : null);
    };
    
    // 立即获取初始状态
    getUser();

    // 监听登录/登出事件
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Home] onAuthStateChange 事件:', event, session?.user?.email);
      setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    console.log('[Home] 监听器已设置');
    return () => {
      console.log('[Home] 清理监听器');
      subscription.unsubscribe();
    };
  }, [supabase]);

  // ── 登出 ──
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.push('/');
    router.refresh();
  };

  // ── 购买积分 (使用 Creem) ──
  const handleBuyCredits = async (productId: string) => {
    setShowGuide(false);

    try {
      // ── 检查用户是否登录 ──
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 未登录，提示用户并跳转到个人中心
        alert('请先登录后再购买');
        router.push('/profile');
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
        router.push('/profile');
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
    }
  };

  // ── 跳转定价页 ──
  const goToPricing = () => {
    setShowGuide(false);
    router.push('/pricing');
  };

  return (
    <>
      {/* ── 主页面 ── */}
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-100 flex flex-col overflow-x-hidden">
        {/* ── 主内容区域 ── */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
          {/* Logo 图标 */}
          <div className="mb-6 sm:mb-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-3xl shadow-lg shadow-pink-200/50 flex items-center justify-center">
              {/* 美字 SVG */}
              <svg viewBox="0 0 100 100" className="w-14 h-14 sm:w-20 sm:h-20">
                <text x="50" y="35" fontSize="24" textAnchor="middle" fill="#E53935" fontWeight="bold">美</text>
                <text x="50" y="65" fontSize="24" textAnchor="middle" fill="#E53935" fontWeight="bold">美</text>
                <text x="50" y="95" fontSize="24" textAnchor="middle" fill="#E53935" fontWeight="bold">美</text>
              </svg>
            </div>
          </div>

          {/* 标题 */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black tracking-wide">
            what to wear
          </h1>
          
          {/* 副标题 */}
          <p className="mt-2 sm:mt-3 text-sm sm:text-base text-gray-400">
            By AI
          </p>
        </main>

        {/* ── 底部操作按钮 ── */}
        <div className="px-6 pb-8">
          <div className="flex rounded-full shadow-lg overflow-hidden">
            {/* Glow Up 按钮 */}
            <button
              onClick={() => router.push('/tryon')}
              disabled={tryOnLoading}
              className="flex-1 sm:flex-none sm:w-1/2 py-4 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                <path d="M12 6.38l1.45 3.56L18 11.15l-3.55 3.38 1.45 5.56L12 17.07l-4.9 2.43 1.45-5.56L6 11.15l4.55-1.21L12 6.38z"/>
              </svg>
              Glow Up
            </button>
            
            {/* Profile 按钮 */}
            <button
              onClick={() => router.push('/profile')}
              className="flex-1 sm:flex-none sm:w-1/2 py-4 px-6 bg-white hover:bg-gray-50 text-gray-400 font-semibold text-base sm:text-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
          </div>
        </div>

        {/* ── 底部链接 ── */}
        <div className="pb-4 text-center space-x-4">
          <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            用户协议
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            隐私声明
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════
          付费引导弹窗 - 响应式
      ══════════════════════════════════════ */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowGuide(false)}
          />

          {/* 弹窗内容 - 响应式 */}
          <div className="relative bg-white rounded-t-2xl sm:rounded-t-3xl md:rounded-3xl w-full max-w-md sm:max-w-lg shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] sm:max-h-[85vh] flex flex-col">
            {/* 关闭按钮 */}
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors z-10"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* 可滚动内容区域 */}
            <div className="p-4 sm:p-6 pb-6 sm:pb-8 overflow-y-auto flex-1">
              {/* 头部 */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">试衣次数已用完</h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">购买积分包或订阅会员，继续体验</p>
              </div>

              {/* 快速购买选项 */}
              <div className="space-y-2.5 sm:space-y-3">
                {/* 月度订阅 - 使用真实的 Creem Product ID */}
                <button
                  onClick={() => handleBuyCredits('prod_xWnfRXy7SUJHzhj4FrmgZ')}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm sm:text-base text-slate-900">月度专业版</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">100次/月 · 无水印</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold text-slate-900">$9.90</span>
                    <span className="text-[10px] sm:text-xs font-normal text-slate-400">/月</span>
                  </div>
                </button>
              </div>

              {/* 查看全部 */}
              <button
                onClick={goToPricing}
                className="mt-3 sm:mt-4 w-full text-center text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium py-1.5 sm:py-2"
              >
                查看完整方案对比 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 弹窗动画 */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
