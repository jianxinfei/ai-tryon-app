'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

interface User {
  id: string;
  email?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // 登录表单状态
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  
  // 邮箱输入框 ref，用于自动聚焦
  const emailInputRef = useRef<HTMLInputElement>(null);
  
  // 从 ?login=true 过来的标记（使用 window.location.search 避免 Suspense 问题）
  const [fromLoginParam, setFromLoginParam] = useState(false);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setFromLoginParam(params.get('login') === 'true');
    }
  }, []);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // 获取用户数据
  const fetchUserData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
      setUser(null);
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
        
        // 登录成功后，如果从 ?login=true 过来，返回 /history 并清除参数
        if (fromLoginParam) {
          console.log('[Account] 登录成功，从 login=true 返回 /history');
          router.push('/history');
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData, supabase, fromLoginParam, router]);
  
  // 从 ?login=true 过来时，自动聚焦邮箱输入框
  useEffect(() => {
    if (fromLoginParam && emailInputRef.current && !user && !loading) {
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 300);
    }
  }, [fromLoginParam, user, loading]);

  // 监听 URL 中的验证参数，检测验证成功
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('#access_token=') || hash.includes('#type=recovery')) {
      console.log('[Account] 检测到验证成功的 URL 参数:', hash);
      setVerificationSuccess(true);
      
      setTimeout(() => {
        router.refresh();
      }, 2000);
    }
  }, [router]);

  // OAuth 登录
  const handleOAuthSignIn = async (provider: 'facebook' | 'github') => {
    setLoginLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/history`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'OAuth login failed, please try again' });
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
            emailRedirectTo: `${window.location.origin}/profile/account`,
          },
        });

        if (error) throw error;

        // 注册成功，初始化积分记录（credits: 0，幂等操作）
        try {
          const { data: { user: newUser } } = await supabase.auth.getUser();
          if (newUser) {
            await fetch('/api/credits/init', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: newUser.id }),
            });
            console.log('[Account] 积分记录初始化完成');
          }
        } catch (initErr) {
          console.warn('[Account] 积分初始化失败（不影响注册）:', initErr);
        }

        // 跳转到历史记录页面
        console.log('[Account] 注册成功，跳转到 /history');
        router.push('/history');
        return;
      } else {
        // 登录
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('Signed in but no session received, please try again');
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Operation failed, please try again' });
    } finally {
      setLoginLoading(false);
    }
  };

  // 处理登出
  const handleLogout = async () => {
    if (!confirm('Are you sure you want to sign out?')) return;

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.push('/history');
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // 获取昵称
  const getNickname = () => {
    if (!user?.email) return 'Guest';
    const prefix = user.email.split('@')[0];
    return prefix.length > 12 ? prefix.substring(0, 12) + '...' : prefix;
  };

  // ══════════════════════════════════════════════
  // 未登录状态 - 显示登录表单
  // ══════════════════════════════════════════════
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-[#FFF7FA] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* 返回按钮 */}
          <button
            onClick={() => router.push('/history')}
            className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Profile
          </button>

          {/* Logo / 标题 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
              <img src="/logo.png" alt="What to Wear" className="w-16 h-16 rounded-2xl" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900">What to Wear</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isSignUp ? 'Create a new account to get started' : 'Sign in to continue'}
            </p>
          </div>

          {/* 验证成功提示 */}
          {verificationSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-center animate-pulse">
              <div className="text-green-600 font-medium">✓ Verification successful, welcome back!</div>
              <div className="text-xs text-green-500 mt-1">Refreshing shortly...</div>
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
            </div>
          )}

          {/* OAuth 登录卡片 - 放在最上方，更醒目 */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8">
            <p className="text-center text-sm font-medium text-slate-700 mb-5">
              {isSignUp ? 'Create an account with' : 'Continue with'}
            </p>

            {/* OAuth 登录按钮 - 更大更醒目 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={loginLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button
                type="button"
                onClick={() => handleOAuthSignIn('github')}
                disabled={loginLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>

            {/* 分隔线 */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">or use email</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* 邮箱登录表单 - 放在下方作为备选 */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {/* 邮箱输入 */}
              <div>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all text-sm"
                />
              </div>

              {/* 密码输入 */}
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignUp ? 'Create password (min 6 chars)' : 'Password'}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
                    transition-all text-sm"
                />
              </div>

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl
                  transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  isSignUp ? 'Sign Up with Email' : 'Sign In with Email'
                )}
              </button>
            </form>

            {/* 切换登录/注册 */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Don\'t have an account? Sign Up'}
              </button>
            </div>

            {/* Terms and Privacy links */}
            <div className="mt-3 text-center space-y-1">
              <Link href="/terms" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                Terms of Service
              </Link>
              <span className="text-slate-300 mx-2">|</span>
              <Link href="/privacy" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // 已登录状态 - 显示账号信息
  // ══════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#FFF7FA] pb-16">
      {/* 顶栏 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          {/* 返回按钮 */}
          <button
            onClick={() => router.push('/history')}
            className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Account & Security</h1>
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* 用户信息卡片 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">👤</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">{getNickname()}</h2>
              {user?.email && (
                <p className="text-sm text-slate-500 truncate mt-0.5">{user.email}</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">User ID</p>
            <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{user?.id}</p>
          </div>
        </div>

        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl shadow-lg shadow-red-200 hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 mb-4"
        >
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </button>

        {/* 版本号 */}
        <div className="text-center text-xs text-slate-400 mt-4">
          What to Wear v1.0.0
        </div>
      </div>
    </div>
  );
}
