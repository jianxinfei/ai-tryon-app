import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'AI Try-On',
  description: 'AI 虚拟试衣 - 上传照片和服装，AI 帮你一键试穿',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="pb-16">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
