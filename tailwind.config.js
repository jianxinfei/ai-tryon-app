/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    // 所有自定义背景色
    'bg-[#FFF7FA]',
    'bg-[#eef3fc]',
    'bg-[#e8e0d5]',
    'bg-[#fef7e0]',
    'bg-[#E01C47]',
    'bg-[#3b82f6]',
    // 所有自定义文字颜色
    'text-[#1f2e3a]',
    'text-[#1e2a3a]',
    'text-[#3b82f6]',
    'text-[#6c7a8a]',
    'text-[#b85c00]',
    'text-[#9CA3AF]',
    // 渐变
    'from-[#3b82f6]',
    'to-[#1e40af]',
  ],
};