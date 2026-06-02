'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface User {
  id: string;
  email?: string;
  email_confirmed_at?: string;
}

interface CreditInfo {
  credits_balance: number;
  total_uses: number;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // 获取用户信息和积分
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // 获取积分信息
        const creditRes = await fetch('/api/credits');
        const creditData = await creditRes.json();

        if (creditRes.ok && creditData.credits_balance !== undefined) {
          setCredits({
            credits_balance: creditData.credits_balance,
            total_uses: creditData.total_uses || 0,
            created_at: creditData.created_at || '',
          });
        }

        if (creditData.user) {
          setUser(creditData.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('获取用户数据失败:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // 处理登录
  const handleLogin = () => {
    router.push('/auth/login');
  };

  // 处理登出
  const handleLogout = async () => {
    if (!confirm('确定要退出登录吗？')) return;

    setIsLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setUser(null);
        setCredits(null);
        router.refresh();
      }
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
        <p className="text-indigo-200 text-sm">管理您的账户和积分</p>
      </div>

      <div className="px-4 -mt-6">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          <div className="flex items-center gap-4">
            {/* 头像占位 */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
              <span className="text-2xl">👤</span>
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

        {/* 功能列表 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">功能</h3>
          </div>

          {/* 我的试衣记录 */}
          <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">📷</span>
              <div>
                <div className="font-medium text-slate-900">我的试衣记录</div>
                <div className="text-xs text-slate-400">查看历史试衣结果</div>
              </div>
            </div>
            <span className="text-slate-300 text-sm">即将上线</span>
          </div>

          {/* 积分充值 */}
          <div
            className="px-4 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => user ? router.push('/pricing') : handleLogin()}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">💎</span>
              <div>
                <div className="font-medium text-slate-900">积分充值</div>
                <div className="text-xs text-slate-400">购买更多试衣次数</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* 账号管理 */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">⚙️</span>
              <div className="font-medium text-slate-900">账号管理</div>
            </div>
            {user ? (
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? '退出中...' : '退出登录'}
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                登录 / 注册
              </button>
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
