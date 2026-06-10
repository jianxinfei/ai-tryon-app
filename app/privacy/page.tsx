'use client';

import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold text-slate-900">Privacy Policy</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <p className="text-sm text-slate-400">Last updated: June 9, 2026</p>

          <p className="text-slate-600 leading-relaxed">
            <strong>What to Wear</strong> ("we," "our," or "us") operates the website at <strong>www.aiwhattowear.com</strong> (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service.
          </p>

          {/* ── Key Points ── */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 sm:p-6">
            <h2 className="text-lg font-bold text-indigo-900 mb-3">Key Points</h2>
            <ul className="space-y-2 text-indigo-800 text-sm leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span>Your uploaded and generated images are stored in a <strong>private storage bucket</strong> — they are never publicly accessible.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span>To generate try-on results, your photos are <strong>sent to Kling AI&apos;s API</strong> and processed only for that purpose. We do not use your photos to train AI models.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span>Payments are handled by <strong>Creem</strong>. We never see or store your full credit card number.</span>
              </li>
            </ul>
          </div>

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
            <h2 className="text-xl font-bold text-slate-900 mb-4">3. Image Storage &amp; Access</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>Your uploaded photos and AI-generated results are stored in <strong>Supabase&apos;s private storage buckets</strong>. These buckets are not publicly accessible — no one can view your images without proper authentication.</li>
              <li>When displaying or downloading images in the app, our backend generates <strong>short-lived signed URLs</strong> that expire after a limited time. These URLs are the only way to access image files, and they cannot be used once expired.</li>
              <li>We do not expose any direct public links to your stored images.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">4. Data Handling: Logged-in vs. Guest Users</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Logged-in users:</strong> Your uploaded photos, generated results, and account data are stored under your account and persist until you manually delete them from your profile.</li>
              <li><strong>Guest users (not logged in):</strong> If you use the service without logging in, your uploaded and generated images are stored only for the duration of the session. They are not permanently saved and will not be accessible after the session ends.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">5. Data Retention &amp; Deletion</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>You may delete your uploaded photos and generated results at any time through your profile settings.</li>
              <li>When you delete data from your account, it is removed from our active application and API responses immediately.</li>
              <li>However, deleted data may persist in server backups and replicated storage for a limited period before being purged during our routine maintenance cycles. We do not retain deleted data beyond what is necessary for backup integrity.</li>
              <li>If you request full account deletion, all associated data will be permanently removed from our active systems.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">6. Third-Party Services</h2>
            <p className="text-slate-600 mb-3">We share data with essential third-party services to operate our app:</p>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Kling AI:</strong> Your uploaded clothing and person photos are transmitted to Kling AI&apos;s API solely for the purpose of generating your virtual try-on result.</li>
              <li><strong>Creem:</strong> Handles all payment processing. Your payment details are subject to Creem&apos;s privacy policy.</li>
              <li><strong>Supabase:</strong> Provides our cloud database and storage infrastructure. Your account and image data are stored securely on Supabase.</li>
              <li><strong>Vercel:</strong> Hosts our web application.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">7. Cookies</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Essential Cookies:</strong> We use cookies that are necessary for the Service to function, including authentication cookies (to keep you logged in), security cookies (to protect against CSRF attacks), and preference cookies (to remember your settings). These cookies cannot be disabled, as the Service would not work without them.</li>
              <li><strong>Analytics Cookies (Optional):</strong> We may use Google Analytics or similar tools to collect anonymous usage data (e.g., page views, device type) to help us improve the Service. These cookies do not collect personal information such as your email or photos. You can opt out of analytics cookies through your browser settings or by using a browser extension that blocks analytics trackers.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">8. Data Security</h2>
            <p className="text-slate-600 leading-relaxed">
              We implement industry-standard security measures, including HTTPS encryption for all data transmission, authentication-based access control for stored images, and secure API key management. Your data is encrypted in transit and stored in access-controlled infrastructure.
            </p>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">9. Your Rights</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>You may access, update, or delete your account information and uploaded photos at any time through your profile settings.</li>
              <li>If you delete your account, all associated data will be permanently removed from our active systems.</li>
              <li>You may contact us to request a copy of your personal data or to ask questions about our data practices.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">10. Contact Us</h2>
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
