'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import BottomNav from '@/components/BottomNav';

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
      // 获取当前 session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
        });

        // 获取积分信息
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

    // 监听认证状态变化
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
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* 顶部标题 */}
      <div className="bg-indigo-600 text-white px-6 py-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold mb-1">个人中心</h1>
        <p className="text-indigo-200 text-sm">
          {user ? '欢迎回来' : '登录后查看更多信息'}
        </p>
      </div>

      <div className="px-4 -mt-6">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <span className="text-2xl">{user ? '👤' : '👤'}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">
                {loading ? '加载中...' : getNickname()}
              </h2>
              <p className="text-sm text-slate-400">
                {user?.email || '点击下方按钮登录'}
              </p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        {user && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">
                {loading ? '-' : (credits?.credits_balance ?? 0)}
              </div>
              <div className="text-sm text-slate-500">积分余额</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
              <div className="text-3xl font-bold text-amber-600 mb-1">
                {loading ? '-' : (credits?.total_uses ?? 0)}
              </div>
              <div className="text-sm text-slate-500">试衣次数</div>
            </div>
          </div>
        )}

        {/* 功能列表 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          {/* 账号管理 */}
          <div className="px-4 py-4">
            {user ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">⚙️</span>
                  <div className="font-medium text-slate-900">账号管理</div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? '退出中...' : '退出登录'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">👤</span>
                  <div className="font-medium text-slate-900">登录账户</div>
                </div>
                <button
                  onClick={handleLogin}
                  className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  登录 / 注册
                </button>
              </>
            )}
          </div>
        </div>

        {/* 版本信息 */}
        <div className="text-center text-xs text-slate-400 mt-6">
          AI Try-On v1.0.0
        </div>
      </div>

      {/* 底部导航 */}
      <BottomNav />
    </div>
  );
}
