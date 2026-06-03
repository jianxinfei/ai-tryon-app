'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 顶栏 */}
      <div className="bg-white border-b border-slate-200 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-slate-500 hover:text-slate-700 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">隐私声明</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-10">
          {/* 中文部分 */}
          <div className="space-y-6">
            <div className="text-center py-4">
              <span className="inline-block px-4 py-1 bg-slate-200 text-slate-600 text-sm rounded-full">中文</span>
            </div>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">1. 信息收集</h2>
              <div className="space-y-3 text-slate-600">
                <p><strong>账号信息：</strong>邮箱地址（用于登录和找回密码）</p>
                <p><strong>用户内容：</strong>您上传的人物照片和服装照片</p>
                <p><strong>支付信息：</strong>由 Creem 支付平台直接处理，我们不会存储您的完整银行卡号</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">2. 信息使用</h2>
              <div className="space-y-3 text-slate-600">
                <p>上传照片仅用于生成 AI 虚拟试衣效果</p>
                <p>生成的试衣效果图仅用于向您展示结果</p>
                <p>邮箱地址仅用于账号相关通知</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">3. 第三方服务</h2>
              <div className="space-y-3 text-slate-600">
                <p><strong>AI 处理：</strong>您的照片会传输至可灵 AI (Kling AI) 进行处理，处理完成后不会用于其他目的</p>
                <p><strong>支付处理：</strong>支付由 Creem 安全处理，我们不会接触您的完整支付信息</p>
                <p><strong>数据存储：</strong>使用 Supabase 提供的加密云存储服务</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">4. 数据安全</h2>
              <div className="space-y-3 text-slate-600">
                <p>所有数据传输采用 HTTPS 加密</p>
                <p>照片存储采用访问控制策略，仅您本人可访问</p>
                <p>我们不会将您的照片用于 AI 模型训练或其他商业用途</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">5. 用户权利</h2>
              <div className="space-y-3 text-slate-600">
                <p>您可以在账户设置中查看和删除已上传的照片</p>
                <p>您可以随时删除账户，所有相关数据将被永久移除</p>
                <p>如有隐私问题，可联系：<a href="mailto:support@aiwhattowear.com" className="text-indigo-600 hover:text-indigo-700">support@aiwhattowear.com</a></p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">6. 数据保留</h2>
              <div className="space-y-3 text-slate-600">
                <p>上传照片和生成结果在您主动删除前会一直保存</p>
                <p>删除账户后，所有数据将在 30 天内从备份中完全清除</p>
              </div>
            </section>
          </div>

          {/* 分隔线 */}
          <div className="border-t border-slate-200" />

          {/* 英文部分 */}
          <div className="space-y-6">
            <div className="text-center py-4">
              <span className="inline-block px-4 py-1 bg-slate-200 text-slate-600 text-sm rounded-full">English</span>
            </div>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">1. Information Collection</h2>
              <div className="space-y-3 text-slate-600">
                <p><strong>Account Information:</strong> Email address (for login and password recovery)</p>
                <p><strong>User Content:</strong> Photos of people and clothing you upload</p>
                <p><strong>Payment Information:</strong> Processed directly by Creem payment platform, we do not store your full card number</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">2. Information Usage</h2>
              <div className="space-y-3 text-slate-600">
                <p>Uploaded photos are only used to generate AI virtual try-on effects</p>
                <p>Generated try-on images are only for displaying results to you</p>
                <p>Email addresses are only used for account-related notifications</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">3. Third-Party Services</h2>
              <div className="space-y-3 text-slate-600">
                <p><strong>AI Processing:</strong> Your photos are transmitted to Kling AI for processing, and will not be used for other purposes after processing</p>
                <p><strong>Payment Processing:</strong> Payments are securely handled by Creem, we do not have access to your complete payment information</p>
                <p><strong>Data Storage:</strong> Using encrypted cloud storage provided by Supabase</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">4. Data Security</h2>
              <div className="space-y-3 text-slate-600">
                <p>All data transmissions are encrypted via HTTPS</p>
                <p>Photo storage uses access control policies, only you can access your photos</p>
                <p>We will not use your photos for AI model training or other commercial purposes</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">5. User Rights</h2>
              <div className="space-y-3 text-slate-600">
                <p>You can view and delete uploaded photos in your account settings</p>
                <p>You can delete your account at any time, and all related data will be permanently removed</p>
                <p>For privacy concerns, contact: <a href="mailto:support@aiwhattowear.com" className="text-indigo-600 hover:text-indigo-700">support@aiwhattowear.com</a></p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-4">6. Data Retention</h2>
              <div className="space-y-3 text-slate-600">
                <p>Uploaded photos and generated results will be kept until you actively delete them</p>
                <p>After account deletion, all data will be completely removed from backups within 30 days</p>
              </div>
            </section>
          </div>

          {/* 最后更新时间 */}
          <div className="text-center text-sm text-slate-400 pt-8">
            最后更新：2026年6月3日 | Last Updated: June 3, 2026
          </div>
        </div>
      </div>
    </div>
  );
}
