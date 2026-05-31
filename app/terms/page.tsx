/**
 * 用户协议与知识产权声明
 *
 * 路径: /terms
 */

import Link from 'next/link';

export const metadata = {
  title: '用户协议与知识产权声明 - AI Try-On',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* 导航栏 */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-900 hover:text-indigo-600 transition-colors">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-sm">AI Try-On</span>
          </Link>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">用户协议与知识产权声明</h1>
        <p className="text-sm text-slate-400 mb-10">最后更新：2025年6月</p>

        {/* ── 第一部分 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">1</span>
            用户上传内容条款
          </h2>
          <div className="space-y-4 pl-8">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">1.1 合法权利保证</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                用户需确保上传至本应用的人物照片和服装图片拥有合法权利，或已获得肖像权、版权持有者的明确许可。用户上传的内容不得侵犯任何第三方的合法权益，包括但不限于肖像权、著作权、商标权等。
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">1.2 侵权责任承担</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                因用户上传内容引发的任何第三方侵权纠纷（包括但不限于肖像权纠纷、著作权纠纷），由用户自行承担全部法律责任。本应用方不承担因用户上传内容导致的任何直接或间接损失。如因此给本应用方造成损失的，用户应当予以赔偿。
              </p>
            </div>
          </div>
        </section>

        {/* ── 第二部分 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">2</span>
            AI 生成内容声明与知识产权归属
          </h2>
          <div className="space-y-4 pl-8">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">2.1 AI 生成内容声明</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                本应用的虚拟试衣效果由 AI 技术生成，仅供用户参考。AI 生成的试衣效果图可能与实际穿着效果存在差异，本应用不对生成内容的准确性、真实性作出任何明示或暗示的保证。用户应根据自身判断决定是否采纳生成结果。
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">2.2 知识产权归属</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                用户使用本服务生成的试衣效果图，其知识产权归用户本人所有，可自由用于个人用途。用户理解并同意，AI 生成内容可能无法完全避免知识产权等风险，用户在将生成内容用于商业用途前应自行评估相关风险。
              </p>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">2.3 数据使用授权</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                用户同意，本应用方有权使用经过匿名化处理后的图片数据，用于改进服务质量、优化 AI 模型效果。本应用方承诺不会将用户的原始图片、个人信息用于模型训练，也不会向任何第三方披露用户的原始上传内容。
              </p>
            </div>
          </div>
        </section>

        {/* ── 技术来源声明 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">3</span>
            技术来源声明
          </h2>
          <div className="pl-8">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 leading-relaxed">
                本应用虚拟试衣功能由<strong>可灵AI（Kling AI）</strong>提供技术支持。可灵AI由北京快手科技有限公司运营，相关技术服务的条款和隐私政策请参阅可灵AI官方平台。
              </p>
            </div>
          </div>
        </section>

        {/* ── 其他声明 ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">4</span>
            其他声明
          </h2>
          <div className="space-y-4 pl-8">
            <div className="p-4 bg-white rounded-xl border border-slate-200">
              <p className="text-sm text-slate-600 leading-relaxed">
                本协议的成立、生效、履行、解释及争议解决均适用中华人民共和国法律。本应用方有权根据法律法规及业务发展需要对本协议进行修订，修订后的协议将在本页面公布。用户继续使用本服务即视为同意修订后的协议。
              </p>
            </div>
          </div>
        </section>

        {/* 返回 */}
        <div className="text-center pt-6 border-t border-slate-100">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
            ← 返回首页
          </Link>
        </div>
      </main>
    </div>
  );
}
