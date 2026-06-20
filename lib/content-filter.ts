// lib/content-filter.ts
// 简单的正则表达式敏感词过滤

const PROFANITY_PATTERNS = [
  // 英文脏话
  /\b(fuck|shit|damn|ass|bitch|bastard|crap|dick|piss|slut|whore|idiot|stupid|dumbass|moron)\b/gi,
  // 广告/垃圾信息关键词
  /\b(buy\s+now|click\s+here|free\s+money|make\s+money|crypto\s+airdrop|nft\s+giveaway|earn\s+\$|lottery|prize\s+winner)\b/gi,
  // URL 垃圾
  /(?:https?:\/\/)?(?:bit\.ly|tinyurl|t\.cn|short\.link)\//gi,
  // 连续重复字符（垃圾刷屏）
  /(.)\1{5,}/g,
  // 邮箱/电话广告
  /\b(?:send\s+(?:me|us)\s+(?:email|msg|dm)|add\s+me\s+on|follow\s+me\s+on\s+(?:instagram|twitter|tiktok|snapchat))\b/gi,
];

// 中文脏话
const CN_PROFANITY = [
  '傻逼', '操你', '他妈的', '去死', '废物', '垃圾人', '脑残',
  '狗日的', '王八蛋', '贱人', '滚蛋', '神经病', '白痴',
];

export function isContentClean(text: string): { clean: boolean; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { clean: false, reason: '评论内容不能为空' };
  }

  if (text.length > 500) {
    return { clean: false, reason: '评论内容不能超过 500 个字符' };
  }

  // 检测英文脏话和广告
  for (const pattern of PROFANITY_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return { clean: false, reason: '内容包含不当用语或广告信息，请修改后重新提交' };
    }
  }

  // 检测中文脏话
  for (const word of CN_PROFANITY) {
    if (text.includes(word)) {
      return { clean: false, reason: '内容包含不当用语，请修改后重新提交' };
    }
  }

  return { clean: true };
}
