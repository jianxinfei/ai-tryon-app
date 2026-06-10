'use client';

import React from 'react';
import Link from 'next/link';

export default function RefundPage() {
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
            <h1 className="text-2xl font-bold text-slate-900">Refund Policy</h1>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <p className="text-sm text-slate-400">Last updated: June 9, 2026</p>

          <p className="text-slate-600 leading-relaxed">
            This page explains how to request a refund for purchases made on <strong>What to Wear</strong> (www.aiwhattowear.com). We aim to keep this policy fair and aligned with the digital nature of our AI virtual try-on service.
          </p>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">How to Request a Refund</h2>
            <p className="text-slate-600 mb-3">
              To request a refund, please email us at{' '}
              <a href="mailto:i_hot@qq.com" className="text-indigo-600 hover:text-indigo-700 font-medium">i_hot@qq.com</a>{' '}
              with the following information:
            </p>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>The <strong>email address</strong> associated with your What to Wear account.</li>
              <li>The <strong>order/receipt ID</strong> (if available) or a screenshot of the payment confirmation.</li>
              <li>A brief <strong>description</strong> of the reason for your request and when the issue occurred.</li>
            </ul>
            <p className="text-slate-600 mt-3">
              We will provide an initial response within <strong>3 business days</strong>.
            </p>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Cases We Typically Refund</h2>
            <p className="text-slate-600 mb-3">We understand that issues can arise. We will typically approve refund requests in the following situations:</p>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Duplicate Charges or Billing Errors:</strong> You were clearly charged more than once for the same purchase.</li>
              <li><strong>Service Unavailability:</strong> A verified technical failure on our part prevented the core AI try-on service from functioning for an extended period.</li>
              <li><strong>Failed Generations Consuming Credits:</strong> If our system experiences a technical error that causes your credits to be deducted without producing a usable result, we may credit the lost credits back to your account or offer a partial refund.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Cases We Typically Do Not Refund</h2>
            <p className="text-slate-600 mb-3">To be sustainable, our refund policy has some limitations:</p>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li><strong>Change of Mind:</strong> As our products are digital credits that are immediately available for use, we generally do not offer refunds for simply changing your mind.</li>
              <li><strong>Low-Quality Results Due to User Input:</strong> The quality of AI-generated images heavily depends on the photos you upload (e.g., lighting, pose, clarity). We do not offer refunds for results that were affected by poor-quality input images.</li>
              <li><strong>Unused Credits After Cancellation:</strong> If you cancel a subscription, you will retain access to your remaining credits until the end of your billing period, but no partial refund will be issued for the remaining time.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Processing and Timing</h2>
            <ul className="space-y-3 text-slate-600 list-disc pl-6">
              <li>All refund requests are reviewed on a case-by-case basis.</li>
              <li>Once approved, refunds are processed manually and will be returned to the original payment method used (typically via Creem).</li>
              <li>The time it takes for the refund to appear in your account depends on your payment method and bank processing times.</li>
            </ul>
          </section>

          <hr className="border-slate-200" />

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Contact Us</h2>
            <p className="text-slate-600 leading-relaxed">
              For all refund inquiries, please first contact our support team at{' '}
              <a href="mailto:i_hot@qq.com" className="text-indigo-600 hover:text-indigo-700 font-medium">i_hot@qq.com</a>.{' '}
              Please do not initiate a chargeback through your bank or Creem before contacting us, as we can likely resolve the issue faster.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
