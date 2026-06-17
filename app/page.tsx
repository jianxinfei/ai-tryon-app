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
        router.push('/history');
        return;
      }

      const res = await fetch('/api/creem/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const data = await res.json();

      if (res.status === 401 || data.needLogin) {
        router.push('/history');
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
      {/* 语言切换器 */}
      <div className="w-full max-w-md flex items-center justify-end gap-2 py-3">
        <Link href="/zh" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">中文</Link>
        <span className="text-xs text-slate-300">|</span>
        <span className="text-xs text-slate-600 font-medium">English</span>
      </div>

      {/* LOGO区域 - 垂直居中 */}
      <div className="w-full max-w-md flex-1 flex flex-col justify-center items-center">
        {/* 标题 */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-slate-900 tracking-tight whitespace-nowrap" style={{ fontFamily: 'Inter', lineHeight: '1.1' }}>
          What to wear?
        </h1>

        {/* 对比文案 */}
        <div className="w-full mt-10 sm:mt-14">
          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {/* 旧方式 - 左上 */}
            <div className="flex-1 flex items-start justify-start md:justify-end p-4">
              <p className="text-left text-sm sm:text-base text-slate-400 leading-relaxed max-w-[260px]" style={{ fontFamily: 'Inter' }}>
                The old way:<br />
                Browse &rarr; Read reviews &rarr; Unbox &rarr; Try on &rarr; Ask around &rarr; Return if not fit
              </p>
            </div>

            {/* VS 分割线 */}
            <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:py-0 md:px-6">
              <div className="w-8 md:w-px h-px md:h-16 bg-slate-300" />
              <span className="text-base font-extrabold text-slate-500 uppercase tracking-widest">vs</span>
              <div className="w-8 md:w-px h-px md:h-16 bg-slate-300" />
            </div>

            {/* 我们的方式 - 右下 */}
            <div className="flex-1 flex items-end justify-end md:justify-start p-4">
              <p className="text-right md:text-left text-lg sm:text-xl font-bold leading-relaxed max-w-[280px] text-slate-900" style={{ fontFamily: 'Inter' }}>
                Us:<br />
                Browse &rarr; Download photo &rarr; Upload to AIWHATTOWEAR &rarr; Get result &rarr; Post &rarr; Get likes &rarr; Order!
              </p>
            </div>
          </div>
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
      {/* 底部链接 */}
      <div className="w-full flex items-center justify-center gap-2 pb-6">
        <a href="#" className="text-xs text-slate-400 hover:text-slate-500 transition-colors">Terms of Service</a>
        <span className="text-xs text-slate-400">|</span>
        <a href="#" className="text-xs text-slate-400 hover:text-slate-500 transition-colors">Privacy Policy</a>
      </div>
    </div>
  );
}
