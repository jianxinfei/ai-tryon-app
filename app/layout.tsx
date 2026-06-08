import './globals.css'

export const metadata = {
  title: 'What to Wear',
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
        {children}
      </body>
    </html>
  )
}
