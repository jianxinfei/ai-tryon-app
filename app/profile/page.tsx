'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface User {
  id: string;
  email?: string;
}

interface CreditInfo {
  credits_balance: number;
  total_uses: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        storageKey: supabaseUrl ? `sb-${new URL(supabaseUrl).hostname}-auth-token` : 'sb-placeholder-auth-token',
        storage: {
          getItem: (key) => {
            if (typeof window === 'undefined') return null;
            try {
              return localStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return;
            try {
              localStorage.setItem(key, value);
            } catch (e) {
              console.error('[Profile] localStorage.setItem 失败:', e);
            }
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return;
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.error('[Profile] localStorage.removeItem 失败:', e);
            }
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    }
  );

  // 获取用户和积分数据
  const fetchUserData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
        });

        const creditRes = await fetch('/api/credits');
        const creditData = await creditRes.json();

        if (creditRes.ok && creditData.credits_balance !== undefined) {
          setCredits({
            credits_balance: creditData.credits_balance,
            total_uses: creditData.total_uses || 0,
          });
        }
      } else {
        setUser(null);
        setCredits(null);
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
      setUser(null);
      setCredits(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
        });
        fetchUserData();
      } else {
        setUser(null);
        setCredits(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData, supabase]);

  // 获取昵称
  const getNickname = () => {
    if (!user?.email) return '未登录';
    const prefix = user.email.split('@')[0];
    return prefix.length > 12 ? prefix.substring(0, 12) + '...' : prefix;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 蓝色渐变顶栏 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          {/* 头像 */}
          <div className="w-16 h-16 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">{user ? '👤' : '👤'}</span>
          </div>
          {/* 昵称和邮箱 */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {loading ? '加载中...' : getNickname()}
            </h1>
            {user?.email && (
              <p className="text-blue-100 text-sm truncate mt-0.5">
                {user.email}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* 统计卡片 - 精致仪表盘样式 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* 积分余额 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-sm p-6 text-center border border-blue-200">
            <div className="text-5xl font-bold text-blue-700 mb-3">
              {loading ? '-' : (credits?.credits_balance ?? 0)}
            </div>
            <div className="text-xs text-slate-500">积分余额</div>
          </div>
          {/* 试衣次数 */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl shadow-sm p-6 text-center border border-amber-200">
            <div className="text-5xl font-bold text-amber-700 mb-3">
              {loading ? '-' : (credits?.total_uses ?? 0)}
            </div>
            <div className="text-xs text-slate-500">试衣次数</div>
          </div>
        </div>

        {/* 购买积分和会员 */}
        <button
          onClick={() => router.push('/pricing')}
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 transition-all mb-4"
        >
          购买积分和会员
        </button>

        {/* 账号与安全入口 */}
        <button
          onClick={() => router.push('/profile/account')}
          className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center justify-between px-5 mb-4"
        >
          <span className="flex items-center gap-3">
            <span className="text-lg">👤</span>
            <span>账号与安全</span>
          </span>
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 版本号 */}
        <div className="text-center text-xs text-slate-400 mt-4">
          AI Try-On v1.0.0
        </div>
      </div>
    </div>
  );
}
