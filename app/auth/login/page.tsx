/**
 * 登录/注册页面
 *
 * 路径: /auth/login
 *
 * 使用自定义 Tailwind CSS 表单，与首页风格一致。
 * 注册/登录成功后自动跳回之前的页面。
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

function AuthLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 获取 Supabase URL 用于生成正确的 storage key
  // 使用默认值避免构建时环境变量未注入的问题
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const [supabaseClient] = useState(() => {
    // 如果环境变量为空，返回一个空操作的客户端（避免构建时报错）
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[Login] Supabase 环境变量未配置，认证功能将不可用');
      return createBrowserClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');
    }
    return createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 使用 Supabase 默认的 storage key 格式
        storageKey: `sb-${new URL(supabaseUrl).hostname}-auth-token`,
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
              console.error('[Login] localStorage.setItem 失败:', e);
            }
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return;
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.error('[Login] localStorage.removeItem 失败:', e);
            }
          },
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  });

  // 调试：检查 Supabase 配置
  useEffect(() => {
    const storageKey = `sb-${new URL(supabaseUrl).hostname}-auth-token`;
    console.log('[Login] Supabase 配置检查:');
    console.log('  - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置');
    console.log('  - Storage key:', storageKey);
    console.log('  - localStorage 可用:', typeof window !== 'undefined' && !!window.localStorage);
    
    // 检查 localStorage 中的 Supabase keys
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('auth') || k.includes('sb-'));
      console.log('  - localStorage 中的 auth keys:', keys);
    }
  }, [supabaseUrl]);

  const redirectTo = searchParams.get('redirectTo') || '/';
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // 监听登录状态变化
  useEffect(() => {
    console.log('[Login] 设置 onAuthStateChange 监听器');
    
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Login] onAuthStateChange 事件:', event, 'session:', session ? '存在' : 'null');
        
        if (event === 'SIGNED_IN') {
          console.log('[Login] 检测到 SIGNED_IN 事件，准备跳转到:', redirectTo);
          
          // 延迟跳转，确保 session 已完全写入本地存储
          setTimeout(() => {
            console.log('[Login] 执行跳转');
            router.push(redirectTo);
            router.refresh();
          }, 100);
        }
      }
    );

    return () => {
      console.log('[Login] 清理监听器');
      subscription.unsubscribe();
    };
  }, [supabaseClient, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        // 注册
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: '注册成功！请检查邮箱完成验证。',
        });
      } else {
        // 登录
        console.log('[Login] 开始登录:', email);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        console.log('[Login] 登录结果:', { 
          hasData: !!data, 
          hasSession: !!data?.session,
          hasError: !!error,
          accessToken: data?.session?.access_token ? '存在' : '缺失'
        });

        if (error) throw error;

        if (!data.session) {
          throw new Error('登录成功但未获取到 session，请重试');
        }

        // 确认 session 已保存到本地存储
        console.log('[Login] 登录成功，开始检查 session 保存状态');
        console.log('[Login] Session 过期时间:', new Date(data.session.expires_at * 1000).toISOString());
        
        // 检查 localStorage 中是否有保存的 session
        const storageKey = `sb-${new URL(supabaseUrl).hostname}-auth-token`;
        const storedSession = localStorage.getItem(storageKey);
        console.log('[Login] Storage key:', storageKey);
        console.log('[Login] localStorage 中的 session:', storedSession ? '已保存' : '未保存');
        
        if (!storedSession) {
          console.warn('[Login] 警告: session 未保存到 localStorage，尝试手动保存');
          // 尝试手动保存 session（使用 Supabase 期望的格式）
          const sessionData = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in,
            user: data.session.user,
          };
          try {
            localStorage.setItem(storageKey, JSON.stringify(sessionData));
            console.log('[Login] 手动保存后再次检查:', localStorage.getItem(storageKey) ? '成功' : '失败');
          } catch (e) {
            console.error('[Login] 手动保存失败:', e);
          }
        }
        
        console.log('[Login] 等待 onAuthStateChange 触发跳转...');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

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

        {/* 消息提示 */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm text-center ${
            message.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-600'
              : 'bg-green-50 border border-green-200 text-green-600'
          }`}>
            {message.text}
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
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl
                shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-200
                transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
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

          {/* 用户协议链接 */}
          <div className="mt-3 text-center">
            <Link href="/terms" className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
              《用户协议与知识产权声明》
            </Link>
          </div>

          {/* 分割线 */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">或</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* 游客模式 */}
          <button
            onClick={() => router.push(redirectTo)}
            className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl
              hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            暂不登录，直接体验
          </button>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push(redirectTo)}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← 返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" /></div>}>
      <AuthLoginContent />
    </Suspense>
  );
}
