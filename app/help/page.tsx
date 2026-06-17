'use client';

import React from 'react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#FFF7FA]">
      <main className="max-w-2xl mx-auto px-4 py-12 pb-20">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8">
          Help & Support
        </h1>

        {/* FAQ */}
        <div className="space-y-4 mb-12">
          <h2 className="text-lg font-bold text-slate-800">Frequently Asked Questions</h2>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">How does virtual try-on work?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Upload a person photo and a clothing photo. Our AI will generate a realistic try-on result showing how the clothing looks on the person.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">What photo formats are supported?</h3>
            <p className="mt-2 text-sm text-slate-500">
              We support JPG and PNG formats. For best results, use clear, well-lit photos with the subject facing forward.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">How many credits do I need?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Each try-on costs 1 credit. You can purchase credit packs or subscribe to our monthly plan for unlimited try-ons.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 text-sm">Is my data safe?</h3>
            <p className="mt-2 text-sm text-slate-500">
              Yes. Your photos are stored securely and only used for generating try-on results. We do not share your data with third parties.
            </p>
          </div>
        </div>

        {/* Legal Links */}
        <div className="text-center space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Legal</h2>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
              Terms of Service
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/privacy" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
