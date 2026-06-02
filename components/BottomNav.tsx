'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/tryon', icon: '✨', label: '试用' },
    { href: '/profile', icon: '👤', label: '我的' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className={`text-xs font-medium ${
                isActive ? 'text-indigo-600' : 'text-slate-400'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-8 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
