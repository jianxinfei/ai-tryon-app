'use client';

import React from 'react';
import Navbar from '@/components/Navbar';

/**
 * 导航栏包装组件
 * 根据当前路径决定是否显示导航栏
 */
export default function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const hideNav = false;

  return (
    <>
      <Navbar hideNav={hideNav} />
      {children}
    </>
  );
}
