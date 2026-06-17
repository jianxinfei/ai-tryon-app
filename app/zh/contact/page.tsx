'use client';

import React from 'react';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#FFF7FA] pb-16">
      {/* 顶栏 */}
      <div className="bg-white border-b border-slate-200 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-700 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">联系我们</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* 说明 */}
          <p className="text-slate-600 leading-relaxed text-lg">
            对 What to Wear 有疑问或反馈？我们很乐意听取您的意见。
          </p>

          {/* 联系邮箱 */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-indigo-900 mb-3">邮箱</h2>
            <p className="text-indigo-800 text-sm leading-relaxed mb-4">
              如有一般咨询、支持请求或反馈，请通过以下方式联系我们：
            </p>
            <a
              href="mailto:i_hot@qq.com"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-base transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              i_hot@qq.com
            </a>
          </div>

          {/* 其他联系方式 */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">其他联系方式</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>访问我们的 <Link href="/help" className="text-indigo-600 hover:text-indigo-700 font-medium">帮助中心</Link> 获取常见问题解答和故障排除。</li>
              <li>查看我们的 <Link href="/pricing" className="text-indigo-600 hover:text-indigo-700 font-medium">定价</Link> 页面了解方案详情。</li>
              <li>关注我们的社交媒体获取更新和技巧。</li>
            </ul>
          </div>

          <hr className="border-slate-200" />

          {/* 底部 */}
          <p className="text-sm text-slate-400">
            我们通常会在24-48小时内回复。感谢您使用 What to Wear！
          </p>
        </div>
      </div>
    </div>
  );
}
