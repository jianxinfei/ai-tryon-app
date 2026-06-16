'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleOAuthSignIn = async (provider: 'facebook' | 'github') => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/history` },
    });
    if (error) {
      setError(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          setError(error.message);
        } else {
          router.push('/history');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(error.message);
        } else {
          router.push('/history');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 半透明背景遮罩 + 模糊效果 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 居中模态框 */}
      <div className="relative bg-[#FAF7F2] rounded-3xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        {/* 右上角关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/60 hover:bg-slate-300/60 transition-colors z-10"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-8 pt-8 pb-6">
          {/* 顶部小标签 */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-[#FF6B6B]" />
            <span className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
              SAVE YOUR WORK
            </span>
          </div>

          {/* 大标题 */}
          <h2 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Save your work.
          </h2>

          {/* 副标题 */}
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Sign in to save results to your Collection and continue across sessions.
          </p>

          {/* 主按钮：Facebook */}
          <button
            onClick={() => handleOAuthSignIn('facebook')}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors mb-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>

          {/* 第二按钮：GitHub */}
          <button
            onClick={() => handleOAuthSignIn('github')}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          {/* 分隔线 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or use email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* 邮箱 + 密码表单 */}
          <form onSubmit={handleSubmit} className="space-y-3 mb-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/70 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
            />
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In with Email'}
            </button>
          </form>

          {/* 切换登录/注册 */}
          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-emerald-700 font-semibold hover:text-emerald-800 transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {/* 底部小字 */}
        <div className="px-8 py-4 border-t border-slate-200/60">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <a href="#" className="hover:text-slate-500 transition-colors">Terms of Service</a>
            <span>|</span>
            <a href="#" className="hover:text-slate-500 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
