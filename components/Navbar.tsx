'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import LoginModal from './LoginModal';

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

  const [showLoginModal, setShowLoginModal] = useState(false);

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

  const isZh = pathname.startsWith('/zh');

  const menuItems = [
    { label: isZh ? '首页' : 'Home', href: '/', icon: '🏠' },
    { label: isZh ? '试衣' : 'Try On', href: '/tryon', icon: '✨' },
    { label: isZh ? '联系' : 'Contact', href: '/contact', icon: '📧' },
    { label: isZh ? '定价' : 'Pricing', href: '/pricing', icon: '💎' },
    { label: isZh ? '帮助' : 'Help', href: '/help', icon: '❓' },
  ];

  const getLocalizedHref = (href: string) => {
    if (href === '/') return isZh ? '/zh' : '/';
    return isZh ? '/zh' + href : href;
  };

  const isActive = (href: string) => {
    const localized = getLocalizedHref(href);
    return pathname === localized || pathname.startsWith(localized + '/');
  };

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* 左边：LOGO */}
          <Link href={isZh ? '/zh' : '/'} className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="What to Wear" className="w-9 h-9 rounded-lg" />
            <span className="text-lg font-bold text-slate-900 hidden sm:inline">AIWHATTOWEAR</span>
          </Link>

          {/* 中间：菜单（桌面端） */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={getLocalizedHref(item.href)}
                className={`px-4 py-2 rounded-full text-base font-medium transition-all duration-200 ${
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
          <div className="flex items-center gap-2.5">
            {/* 语言切换 */}
            <div className="flex items-center bg-slate-100 rounded-full p-0.5">
              <Link
                href={pathname.startsWith('/zh') ? pathname.replace('/zh', '') || '/' : pathname}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  !pathname.startsWith('/zh')
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                EN
              </Link>
              <Link
                href={pathname.startsWith('/zh') ? pathname : '/zh' + pathname}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  pathname.startsWith('/zh')
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                中文
              </Link>
            </div>

            {/* 登录按钮（桌面端） */}
            <div className="hidden md:block">
              {loading ? (
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
              ) : user ? (
                <button
                  onClick={() => router.push('/history')}
                  className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-slate-100 transition-colors"
                  title="Go to History"
                >
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-5 py-2 rounded-full bg-slate-900 text-white text-base font-medium hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* 移动端汉堡菜单 */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  href={getLocalizedHref(item.href)}
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
                    onClick={() => { setMobileMenuOpen(false); router.push(isZh ? '/zh/history' : '/history'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-50 w-full transition-all"
                  >
                    <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
                    {isZh ? '历史记录' : 'History'}
                  </button>
                ) : (
                  <button
                    onClick={() => { setMobileMenuOpen(false); setShowLoginModal(true); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-50 w-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {isZh ? '登录' : 'Sign In'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 登录模态框 */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* 导航栏占位高度 */}
      <div className="h-14" />
    </>
  );
}
