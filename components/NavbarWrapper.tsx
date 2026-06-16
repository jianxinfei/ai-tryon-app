'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';

/**
 * 导航栏包装组件
 * 根据当前路径决定是否显示导航栏
 * 首页和 profile 页面隐藏顶部导航（它们有自己的底部导航栏）
 */
export default function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // profile 页面隐藏顶部导航（它有自己的底部导航栏）
  const hideNav = pathname === '/profile';

  return (
    <>
      <Navbar hideNav={hideNav} />
      {children}
    </>
  );
}
