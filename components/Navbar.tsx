'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

/**
 * 全局导航栏组件
 *
 * 布局：左边 LOGO，中间菜单（试穿、使用指南、定价、帮助），右边语言切换 + 登录
 * 样式：半透明毛玻璃效果，固定在顶部
 */

interface NavbarProps {
  hideNav?: boolean; // 首页和 profile 页面隐藏顶部导航
}

export default function Navbar({ hideNav = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  // 监听滚动，改变导航栏背景
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [pathname]);

  // 关闭移动端菜单
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const menuItems = [
    { label: 'Home', href: '/', icon: '🏠' },
    { label: 'Try On', href: '/tryon', icon: '✨' },
    { label: 'Guide', href: '/guide', icon: '📖' },
    { label: 'Pricing', href: '/pricing', icon: '💎' },
    { label: 'Help', href: '/help', icon: '❓' },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  if (hideNav) return null;

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-100/50'
            : 'bg-[#FFF7FA]/60 backdrop-blur-md'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* 左边：LOGO */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/logo.png" alt="What to Wear" className="w-8 h-8 rounded-lg" />
            <span className="text-base font-bold text-slate-900 hidden sm:inline">What to Wear</span>
          </Link>

          {/* 中间：菜单（桌面端） */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive(item.href)
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* 右边：语言切换 + 登录 */}
          <div className="flex items-center gap-2">
            {/* 语言切换 */}
            <button
              onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Switch language"
            >
              {lang === 'en' ? '中文' : 'EN'}
            </button>

            {/* 登录按钮（桌面端） */}
            <div className="hidden md:block">
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
              ) : user ? (
                <button
                  onClick={() => router.push('/profile')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-400 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {(user.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden lg:inline">Profile</span>
                </button>
              ) : (
                <button
                  onClick={() => router.push('/profile/account?login=true')}
                  className="px-4 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* 移动端汉堡菜单 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* 移动端下拉菜单 */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-14 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-lg">
            <div className="max-w-6xl mx-auto px-4 py-3 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div className="border-t border-slate-100 mt-2 pt-2">
                {loading ? null : user ? (
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/profile'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-50 w-full transition-all"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600">
                        {(user.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    Profile
                  </button>
                ) : (
                  <button
                    onClick={() => { setMobileMenuOpen(false); router.push('/profile/account?login=true'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-50 w-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导航栏占位高度 */}
      <div className="h-14" />
    </>
  );
}
