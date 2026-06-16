/**
 * 首页 - what to wear
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

interface CreditInfo {
  credits_balance: number;
  can_try: boolean;
  use_type: string;
}

export default function HomePage() {
  const router = useRouter();
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/credits', { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (res.ok) {
        const data = await res.json();
        setCredits(data);
      } else if (res.status === 401) {
        // 未登录，不显示错误，积分保持为 null
        console.log('首页：用户未登录，不显示积分');
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

  const [supabase] = useState(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createBrowserClient(supabaseUrl, supabaseKey);
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      setCurrentUser(user ? { id: user.id, email: user.email } : null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleBuyCredits = async (productId: string) => {
    setShowGuide(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please sign in before purchasing');
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
        alert(data.error || 'Failed to create payment session, please try again');
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert('Failed to get payment link, please try again');
      }
    } catch (err) {
      console.error('购买失败:', err);
      alert('Network error, please try again');
    }
  };

  const goToPricing = () => {
    setShowGuide(false);
    router.push('/pricing');
  };

  return (
    <div className="min-h-screen bg-[#FFF7FA] flex flex-col items-center px-4">
      {/* LOGO区域 - 垂直居中 */}
      <div className="w-full max-w-md flex-1 flex flex-col justify-center items-center">
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <div className="flex items-center justify-center" style={{ width: '129px', height: '100px', background: '#FD7700', borderRadius: '28px', boxShadow: '0px 4px 4px 0px rgba(0, 0, 0, 0.25)' }}>
            <span style={{ color: '#FFFFFF', fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif', fontSize: '64px', fontWeight: 500, lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>美</span>
          </div>

          {/* 标题 */}
          <h1 style={{ color: '#1A1A1A', fontFamily: 'Inter', fontSize: '30px', fontWeight: 700, lineHeight: '1.2', margin: 0, padding: 0 }}>AIWHATTOWEAR</h1>
          <p style={{ color: '#9CA3AF', fontFamily: 'Inter', fontSize: '13px', fontWeight: 500, lineHeight: '1', margin: 0, padding: 0 }}>By AI</p>
        </div>
      </div>

      {/* 底部区域：链接 + 导航 */}
      <div className="w-full max-w-md flex flex-col items-center" style={{ paddingBottom: '20px' }}>
        {/* 底部链接 */}
        <div className="text-center space-x-4" style={{ paddingBottom: '16px' }}>
          <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Terms of Service
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Privacy Policy
          </Link>
        </div>

        {/* 导航栏 */}
        <div className="w-full max-w-[348px] flex" style={{ height: '62px', padding: '0px', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '36px' }}>
          <button
            onClick={() => router.push('/tryon')}
            className="hover:bg-red-700 transition-all active:scale-98 flex-1 h-full flex flex-col justify-center items-center gap-1"
            style={{ background: '#E01C47', borderRadius: '26px' }}
          >
            <span style={{ color: '#FFF', fontFamily: 'Inter', fontSize: '18px', fontWeight: 600 }}>Glow Up</span>
            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="#FFF">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              <path d="M12 6.38l1.45 3.56L18 11.15l-3.55 3.38 1.45 5.56L12 17.07l-4.9 2.43 1.45-5.56L6 11.15l4.55-1.21L12 6.38z"/>
            </svg>
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="hover:bg-gray-100 transition-all active:scale-98 flex-1 h-full flex flex-col justify-center items-center gap-1"
            style={{ background: '#FFF', borderRadius: '26px' }}
          >
            <span style={{ color: '#9CA3AF', fontFamily: 'Inter', fontSize: '18px', fontWeight: 600 }}>Profile</span>
            <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 付费引导弹窗 */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowGuide(false)} />
          <div className="relative bg-white rounded-t-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6 pb-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900">No try-ons remaining</h2>
                <p className="mt-1 text-sm text-slate-500">Purchase a credit pack or subscribe to continue</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleBuyCredits('prod_xWnfRXy7SUJHzhj4FrmgZ')}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all"
                >
                  <div className="text-left">
                    <p className="font-semibold text-base text-slate-900">Monthly Pro</p>
                    <p className="text-xs text-slate-400">100/month · No watermark</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900">$9.90</span>
                    <span className="text-xs font-normal text-slate-400">/month</span>
                  </div>
                </button>
              </div>
              <button onClick={goToPricing} className="mt-4 w-full text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2">
                View all plans &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
