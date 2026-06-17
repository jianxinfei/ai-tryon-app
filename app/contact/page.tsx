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
            <h1 className="text-2xl font-bold text-slate-900">Contact Us</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* 说明 */}
          <p className="text-slate-600 leading-relaxed text-lg">
            Have questions or feedback about What to Wear? We&apos;d love to hear from you.
          </p>

          {/* 联系邮箱 */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg font-bold text-indigo-900 mb-3">Email</h2>
            <p className="text-indigo-800 text-sm leading-relaxed mb-4">
              For general inquiries, support requests, or feedback, please reach out to us at:
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
            <h2 className="text-xl font-bold text-slate-900">Other Ways to Connect</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>Visit our <Link href="/help" className="text-indigo-600 hover:text-indigo-700 font-medium">Help Center</Link> for FAQs and troubleshooting.</li>
              <li>Check out our <Link href="/pricing" className="text-indigo-600 hover:text-indigo-700 font-medium">Pricing</Link> page for plan details.</li>
              <li>Follow us on social media for updates and tips.</li>
            </ul>
          </div>

          <hr className="border-slate-200" />

          {/* 底部 */}
          <p className="text-sm text-slate-400">
            We typically respond within 24–48 hours. Thank you for using What to Wear!
          </p>
        </div>
      </div>
    </div>
  );
}
