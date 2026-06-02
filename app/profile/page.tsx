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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

  // 处理登录
  const handleLogin = () => {
    router.push('/auth/login');
  };

  // 处理登出
  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？')) return;

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setCredits(null);
      router.refresh();
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 获取昵称
  const getNickname = () => {
    if (!user?.email) return '未登录用户';
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
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* 积分余额 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-sm p-6 text-center border border-blue-200">
            <div className="text-4xl font-bold text-blue-700 mb-2">
              {loading ? '-' : (credits?.credits_balance ?? 0)}
            </div>
            <div className="text-sm text-blue-600 font-medium">积分余额</div>
          </div>
          {/* 试衣次数 */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl shadow-sm p-6 text-center border border-amber-200">
            <div className="text-4xl font-bold text-amber-700 mb-2">
              {loading ? '-' : (credits?.total_uses ?? 0)}
            </div>
            <div className="text-sm text-amber-600 font-medium">试衣次数</div>
          </div>
        </div>

        {/* 功能按钮 */}
        {user ? (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-200 hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 mb-4"
          >
            {isLoggingOut ? '退出中...' : '退出登录'}
          </button>
        ) : (
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:from-blue-700 hover:to-blue-800 transition-all mb-4"
          >
            登录 / 注册
          </button>
        )}

        {/* 版本号 */}
        <div className="text-center text-xs text-slate-400 mt-4">
          AI Try-On v1.0.0
        </div>
      </div>
    </div>
  );
}
