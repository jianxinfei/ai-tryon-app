'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

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
  
  // 登录表单状态
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [showResendButton, setShowResendButton] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

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

  // 监听 URL 中的验证参数，检测验证成功
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('#access_token=') || hash.includes('#type=recovery')) {
      console.log('[Profile] 检测到验证成功的 URL 参数:', hash);
      setVerificationSuccess(true);
      
      setTimeout(() => {
        router.refresh();
      }, 2000);
    }
  }, [router]);

  // 重新发送验证邮件
  const resendVerificationEmail = async () => {
    if (!email) {
      setMessage({ type: 'error', text: '请先输入邮箱地址' });
      return;
    }
    
    try {
      setLoginLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`,
        },
      });
      
      if (error) throw error;
      
      setMessage({
        type: 'success',
        text: '验证邮件已重新发送，请检查邮箱',
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '发送失败，请重试' });
    } finally {
      setLoginLoading(false);
    }
  };

  // 处理登录/注册
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // 注册
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
          },
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: '验证邮件已发送至您的邮箱，请点击邮件中的链接完成验证',
        });
        setShowResendButton(true);
      } else {
        // 登录
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('登录成功但未获取到 session，请重试');
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败，请重试' });
    } finally {
      setLoginLoading(false);
    }
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

  // 未登录状态 - 显示登录表单
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo / 标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">AI Try-On</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSignUp ? '创建新账号开始体验' : '登录以继续使用'}
            </p>
          </div>

          {/* 验证成功提示 */}
          {verificationSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-pulse">
              <div className="text-green-600 font-medium">✓ 验证成功，欢迎回来！</div>
              <div className="text-xs text-green-500 mt-1">即将为您刷新...</div>
            </div>
          )}

          {/* 消息提示 */}
          {message && (
            <div className={`mb-4 p-4 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-600'
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}>
              <div className="text-center">{message.text}</div>
              {showResendButton && message.type === 'success' && (
                <button
                  onClick={resendVerificationEmail}
                  disabled={loginLoading}
                  className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg
                    transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  重新发送验证邮件
                </button>
              )}
            </div>
          )}

          {/* 表单卡片 */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 邮箱输入 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all"
                />
              </div>

              {/* 密码输入 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? '至少6位字符' : '输入密码'}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all"
                />
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl
                  shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200
                  transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    处理中...
                  </span>
                ) : (
                  isSignUp ? '注册账号' : '登录'
                )}
              </button>
            </form>

            {/* 没有收到验证邮件？ */}
            {!isSignUp && (
              <div className="mt-4 text-center">
                <button
                  onClick={resendVerificationEmail}
                  disabled={loginLoading}
                  className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  没有收到验证邮件？点击重新发送
                </button>
              </div>
            )}

            {/* 切换登录/注册 */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {isSignUp ? '已有账号？点击登录' : '还没有账号？点击注册'}
              </button>
            </div>

            {/* 用户协议和隐私声明链接 */}
            <div className="mt-3 text-center space-y-1">
              <Link href="/terms" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                《用户协议与知识产权声明》
              </Link>
              <span className="text-slate-300 mx-2">|</span>
              <Link href="/privacy" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                《隐私声明》
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 已登录状态 - 显示个人中心
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
          className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-600 transition-all mb-6"
        >
          购买积分和会员
        </button>

        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-200 hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 mb-4"
        >
          {isLoggingOut ? '退出中...' : '退出登录'}
        </button>

        {/* 版本号 */}
        <div className="text-center text-xs text-slate-400 mt-4">
          AI Try-On v1.0.0
        </div>
      </div>
    </div>
  );
}