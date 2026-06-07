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
            <Link href="/" className="text-slate-500 hover:text-slate-700 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <p className="text-sm text-slate-400">Last updated: June 8, 2026</p>

          <p className="text-slate-600 leading-relaxed">
            <strong>What to Wear</strong> ("we," "our," or "us") operates the website at <strong>www.aiwhattowear.com</strong> (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service.
          </p>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">1. Information We Collect</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Account Information:</strong> When you register, we collect your email address to create and authenticate your account.</li>
              <li><strong>User Content:</strong> We collect the photos you upload for virtual try-on, including person images and clothing images.</li>
              <li><strong>Generated Content:</strong> We store the AI-generated try-on result images to provide you with the service.</li>
              <li><strong>Payment Information:</strong> Payments are processed securely by <strong>Creem</strong>, our third-party payment provider. We do not store your full credit card details. Creem may collect payment method details and billing address according to its own privacy policy.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">2. How We Use Your Information</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>To provide, maintain, and improve our AI try-on service.</li>
              <li>To process your transactions and manage your account credits.</li>
              <li>To communicate with you, including sending service-related emails (e.g., account verification).</li>
              <li><strong>We do NOT use your personal photos or generated images to train AI models</strong> or for any unrelated commercial purposes.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">3. Third-Party Services</h2>
            <p className="text-slate-600 mb-3">We share data with essential third-party services to operate our app:</p>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Kling AI:</strong> Your uploaded clothing and person photos are transmitted to Kling AI's API solely for the purpose of generating your virtual try-on result.</li>
              <li><strong>Creem:</strong> Handles all payment processing. Your payment details are subject to Creem's privacy policy.</li>
              <li><strong>Supabase:</strong> Provides our cloud database and storage infrastructure. Your account and image data are stored securely on Supabase.</li>
              <li><strong>Vercel:</strong> Hosts our web application.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Data Security</h2>
            <p className="text-slate-600 leading-relaxed">
              We implement industry-standard security measures, including HTTPS encryption for all data transmission. Your uploaded photos are stored with access control and are only accessible by you when logged into your account.
            </p>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">5. Your Rights</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>You may access, update, or delete your account information and uploaded photos at any time through your profile settings.</li>
              <li>If you delete your account, all associated data will be permanently removed from our active systems.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">6. Contact Us</h2>
            <p className="text-slate-600">
              If you have any questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:i_hot@qq.com" className="text-indigo-600 hover:text-indigo-700 font-medium">i_hot@qq.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
