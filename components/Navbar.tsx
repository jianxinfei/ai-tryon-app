'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import LoginModal from './LoginModal';

interface NavbarProps {
  hideNav?: boolean;
}

export default function Navbar({ hideNav = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          try {
            const res = await fetch('/api/credits');
            if (res.ok) {
              const data = await res.json();
              setCredits(data.credits_balance ?? 0);
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isZh = pathname.startsWith('/zh');

  const menuItems = [
    { label: isZh ? '首页' : 'Home', href: '/', icon: '🏠' },
    { label: isZh ? '试衣' : 'Try On', href: '/tryon', icon: '✨' },
    { label: isZh ? '试衣间' : 'Fitting Room', href: '/community', icon: '💬' },
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
    // 首页需要精确匹配，避免 /zh/help 也匹配到 /zh
    if (href === '/') {
      return pathname === localized;
    }
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
          <Link href={isZh ? '/zh' : '/'} className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="What to Wear" className="w-9 h-9 rounded-lg" />
            <span className="text-lg font-bold text-slate-900 hidden sm:inline">AIWHATTOWEAR</span>
          </Link>

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

          <div className="flex items-center gap-2.5">
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

            <div className="hidden md:block">
              {loading ? (
                <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
              ) : user ? (
                <button
                  onClick={() => router.push('/history')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  title={isZh ? '查看历史记录' : 'Go to History'}
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.5)] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white leading-none">
                      {credits}
                    </span>
                  </div>
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
                    <div className="w-7 h-7 rounded-full bg-emerald-400 shadow-[0_0_10px_3px_rgba(52,211,153,0.5)] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white leading-none">
                        {credits}
                      </span>
                    </div>
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

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
      <div className="h-14" />
    </>
  );
}
