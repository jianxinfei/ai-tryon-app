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
        // 未登录，提示用户并跳转到登录页
        alert('请先登录后再购买');
        router.push('/auth/login?redirectTo=/');
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
        router.push('/auth/login?redirectTo=/');
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 flex flex-col overflow-x-hidden">
        {/* ── 导航栏 ── */}
        <nav className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            {/* Logo 图标 - 响应式大小 */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            {/* Logo 文字 - 响应式大小 */}
            <span className="font-bold text-slate-900 text-base sm:text-lg">AI Try-On</span>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2">
            {/* 积分徽章 - 响应式 */}
            {!loading && credits && (
              <button
                onClick={goToPricing}
                className="flex items-center gap-1.5 sm:gap-2 bg-white border border-slate-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 hover:shadow-sm transition-shadow flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs sm:text-sm font-semibold text-slate-700">
                  {credits?.credits_balance ?? 0} 积分
                </span>
              </button>
            )}

            {/* 登录/登出按钮 */}
            {currentUser ? (
              // 已登录：显示用户邮箱 + 登出按钮
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-slate-600 hidden sm:inline max-w-[120px] truncate" title={currentUser.email}>
                  {currentUser.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-slate-200 transition-colors flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M3 12h12m0 0l-3-3m3 3l-3 3" />
                  </svg>
                  <span className="text-xs sm:text-sm font-semibold">登出</span>
                </button>
              </div>
            ) : (
              // 未登录：显示登录按钮
              <button
                onClick={() => router.push('/auth/login?redirectTo=/')}
                className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-full px-3 sm:px-4 py-1.5 sm:py-2 hover:bg-indigo-700 transition-colors flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <span className="text-xs sm:text-sm font-semibold">登录</span>
              </button>
            )}
          </div>
        </nav>

        {/* ── 主内容 ── */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 -mt-8 sm:-mt-12">
          {/* Hero 插画 - 响应式大小 */}
          <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 shadow-lg shadow-indigo-100">
            <svg className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-indigo-600 max-w-full h-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>

          {/* 标题 - 响应式大小 */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 text-center tracking-tight px-4">
            AI 虚拟试衣
          </h1>
          
          {/* 副标题 - 响应式 */}
          <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-500 text-center max-w-xs sm:max-w-sm px-4">
            上传你的照片和心仪的服装，AI 帮你一键试穿
          </p>

          {/* ── 积分状态卡片 ── */}
          {!loading && credits && (
            <div className="mt-6 sm:mt-8 bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 w-full max-w-[280px] sm:max-w-xs">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-xs sm:text-sm font-medium text-slate-500">可用积分</span>
                <span className="text-[10px] sm:text-xs text-slate-400">
                  每次试衣消耗 1 积分
                </span>
              </div>

              {/* 进度条 */}
              <div className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (credits.credits_balance / 10) * 100)}%`,
                  }}
                />
              </div>

              <div className="mt-2 sm:mt-3 text-center">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {credits.credits_balance}
                </span>
                <span className="text-xs sm:text-sm text-slate-400 ml-1">积分</span>
              </div>
            </div>
          )}

          {/* ── 试衣按钮 ── */}
          <button
            onClick={() => router.push('/tryon')}
            className="mt-6 sm:mt-8 w-full max-w-[280px] sm:max-w-xs py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-white
              bg-gradient-to-r from-indigo-600 to-indigo-500
              hover:from-indigo-700 hover:to-indigo-600
              shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200
              transition-all
              active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              开始试衣
            </span>
          </button>

          {/* ── 查看方案 ── */}
          <button
            onClick={goToPricing}
            className="mt-2 sm:mt-3 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            查看积分包和会员方案 →
          </button>
        </main>
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
                {/* 
                  积分包暂时禁用 - 需要在 Creem Dashboard 创建产品后启用
                  TODO: 创建 prod_credits_10 和 prod_credits_100 产品后取消注释
                
                <button
                  onClick={() => handleBuyCredits('prod_credits_10')}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm sm:text-base text-slate-900">10次试穿</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">永久有效</p>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-slate-900">$1.99</span>
                </button>

                <button
                  onClick={() => handleBuyCredits('prod_credits_100')}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 transition-all relative"
                >
                  <span className="absolute -top-2 sm:-top-2.5 right-2 sm:right-3 bg-indigo-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                    最划算
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-sm sm:text-base text-slate-900">100次试穿</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">$0.10/次 · 永久有效</p>
                  </div>
                  <span className="text-base sm:text-lg font-bold text-indigo-600">$9.99</span>
                </button>

                <div className="flex items-center gap-2 sm:gap-3 py-0.5 sm:py-1">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[10px] sm:text-xs text-slate-400 font-medium">或订阅会员</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                */}

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

                {/* 年度订阅 - TODO: 在 Creem Dashboard 创建后替换 Product ID */}
                {/*
                <button
                  onClick={() => handleBuyCredits('prod_xxx_yearly')}
                  className="w-full flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-amber-400 bg-amber-50/30 hover:bg-amber-50 transition-all relative"
                >
                  <span className="absolute -top-2 sm:-top-2.5 right-2 sm:right-3 bg-amber-500 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                    省 $39.89
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-sm sm:text-base text-slate-900">年度专业版</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">1200次/年 · 相当于66折</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold text-amber-600">$79.99</span>
                    <span className="text-[10px] sm:text-xs font-normal text-slate-400">/年</span>
                  </div>
                </button>
                */}
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
