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

        const creditRes = await fetch('/api/credits', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
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
    <div className="" style={{ width: '390px', height: '844px', margin: '0 auto', background: '#FFF7FA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 顶部栏：账户信息入口 + 登录状态 */}
      <div className="flex justify-end items-center gap-2.5 pt-16 px-6">
        {user ? (
          <button
            onClick={() => router.push('/profile/account')}
            className="text-[15px] font-semibold text-[#1e2a3a] bg-[#eef3fc] px-4 py-1.5 rounded-[30px]"
          >
            已登录
          </button>
        ) : (
          <button
            onClick={() => router.push('/profile/account')}
            className="text-[15px] font-semibold text-[#1e2a3a] bg-[#eef3fc] px-4 py-1.5 rounded-[30px]"
          >
            登录
          </button>
        )}
      </div>

      {/* 头像 + 用户信息 */}
      <div className="flex items-center gap-4 pt-8 px-6">
        <div className="w-20 h-20 rounded-full bg-[#e8e0d5] flex items-center justify-center flex-shrink-0 overflow-hidden">
          <svg viewBox="0 0 100 100" fill="none" className="w-[52px] h-[52px]">
            <circle cx="50" cy="45" r="28" fill="#f4a261"/>
            <path d="M22 45c0-18 12-32 28-32s28 14 28 32" fill="#2d1810"/>
            <path d="M22 45c-2-8 2-16 8-20" fill="#2d1810"/>
            <circle cx="40" cy="48" r="3" fill="#2d1810"/>
            <circle cx="60" cy="48" r="3" fill="#2d1810"/>
            <path d="M42 58q8 6 16 0" stroke="#c75c3a" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <rect x="42" y="70" width="16" height="12" fill="#f4a261"/>
            <path d="M25 82q25-8 50 0v18H25z" fill="#6b8cae"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-[#1e2a3a] truncate">
            {loading ? '加载中...' : (user?.email || 'user@example.com')}
          </h1>
        </div>
      </div>

      {/* 积分 - 蓝色居中 */}
      <div className="text-center pt-6 px-6">
        <div className="text-[64px] font-extrabold text-[#3b82f6] leading-none tracking-tight">
          {loading ? '-' : (credits?.credits_balance ?? 0)}
        </div>
        <div className="text-[13px] text-[#6c7a8a] font-medium mt-1">credits</div>
      </div>

      {/* 邮箱未认证 */}
      <div className="bg-[#fef7e0] rounded-[20px] p-3.5 mx-6 mt-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#b85c00] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#b85c00]">邮箱未认证</span>
            <span className="text-[11px] text-[#9CA3AF]">未验证用户无法享受试衣服务</span>
          </div>
        </div>
      </div>

      {/* 购买积分和会员 */}
      <div className="px-6 pt-5">
        <button
          onClick={() => router.push('/pricing')}
          className="w-full py-4 bg-gradient-to-br from-[#3b82f6] to-[#1e40af] text-white text-[18px] font-bold rounded-[60px] shadow-lg flex items-center justify-center gap-1 active:scale-[0.97] active:opacity-90 transition-all"
        >
          <span>$</span>
          <span>9.9 订阅月度专业版</span>
        </button>
      </div>

      {/* 版本号 */}
      <div className="text-center text-xs text-slate-400 mt-4">
        AI Try-On v1.0.0
      </div>

      {/* 底部导航栏 - 与主页完全一致 */}
      <div className="mt-auto flex items-center justify-center" style={{ padding: '0' }}>
        <div style={{ width: '390px', height: '95px', display: 'flex', padding: '4px', alignItems: 'center', justifyContent: 'center', background: '#FFF7FA', borderRadius: '36px' }}>
          <div style={{ width: '348px', height: '62px', display: 'flex', padding: '0px', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: '36px' }}>
            <button
              onClick={() => router.push('/tryon')}
              className="hover:bg-gray-100 transition-all active:scale-98"
              style={{ width: '174px', height: '62px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', background: '#FFFFFF', borderRadius: '26px' }}
            >
              <span style={{ color: '#9CA3AF', fontFamily: 'Inter', fontSize: '18px', fontWeight: 600 }}>Glow Up</span>
              <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="#9CA3AF">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                <path d="M12 6.38l1.45 3.56L18 11.15l-3.55 3.38 1.45 5.56L12 17.07l-4.9 2.43 1.45-5.56L6 11.15l4.55-1.21L12 6.38z"/>
              </svg>
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="hover:bg-red-700 transition-all active:scale-98"
              style={{ width: '174px', height: '62px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', background: '#E01C47', borderRadius: '26px' }}
            >
              <span style={{ color: '#FFF', fontFamily: 'Inter', fontSize: '18px', fontWeight: 600 }}>Profile</span>
              <svg style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="#FFF" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
{/* 强制 Tailwind 编译所有自定义颜色 */}
<div className="hidden bg-[#FFF7FA] text-[#3b82f6] bg-[#E01C47] bg-[#eef3fc] bg-[#fef7e0] text-[#1e2a3a] text-[#6c7a8a] text-[#b85c00] text-[#9CA3AF] bg-[#e8e0d5] from-[#3b82f6] to-[#1e40af]"></div>