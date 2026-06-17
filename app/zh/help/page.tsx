'use client';

import React from 'react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#FFF7FA]">
      <main className="max-w-2xl mx-auto px-4 py-12 pb-20">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8">
          帮助与支持
        </h1>

        {/* FAQ */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-bold text-slate-800">常见问题</h2>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">虚拟试衣如何工作？</h3>
            <p className="mt-2 text-sm text-slate-500">
              上传人物照片和服装照片。我们的AI将生成逼真的试穿效果，展示服装穿在人物身上的样子。
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">支持哪些照片格式？</h3>
            <p className="mt-2 text-sm text-slate-500">
              我们支持JPG和PNG格式。为获得最佳效果，请使用清晰、光线充足、人物正面朝向的照片。
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">我需要多少积分？</h3>
            <p className="mt-2 text-sm text-slate-500">
              每次试穿消耗1积分。您可以购买积分包或订阅月度计划获得无限试穿。
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">我的数据安全吗？</h3>
            <p className="mt-2 text-sm text-slate-500">
              是的。您的照片被安全存储，仅用于生成试穿效果。我们不会与第三方分享您的数据。
            </p>
          </div>
        </div>

        {/* Legal Links */}
        <div className="text-center space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">法律信息</h2>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
              服务条款
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/privacy" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
              隐私政策
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
