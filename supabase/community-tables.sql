-- ============================================
-- WtW 社区功能 - Supabase 建表 SQL
-- 在 Supabase SQL Editor 中执行
-- ============================================

-- 1. 社区帖子表
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result_image_url TEXT NOT NULL,
  caption TEXT,
  product_link TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'rejected', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 社区评论表
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 社区举报表
CREATE TABLE IF NOT EXISTS community_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES community_comments(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_community_posts_status_created ON community_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_reports_comment_id ON community_reports(comment_id);

-- 5. 开启 RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

-- 6. RLS 策略 - community_posts
-- 所有人可以查看已审核的帖子
CREATE POLICY "Anyone can view approved posts"
  ON community_posts FOR SELECT
  USING (status = 'approved');

-- 帖子作者可以查看自己的帖子（任何状态）
CREATE POLICY "Users can view own posts"
  ON community_posts FOR SELECT
  USING (auth.uid() = user_id);

-- 登录用户可以发帖
CREATE POLICY "Authenticated users can create posts"
  ON community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 帖子作者可以更新自己的帖子
CREATE POLICY "Users can update own posts"
  ON community_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- 7. RLS 策略 - community_comments
-- 所有人可以查看评论
CREATE POLICY "Anyone can view comments"
  ON community_comments FOR SELECT
  USING (true);

-- 登录用户可以发表评论
CREATE POLICY "Authenticated users can create comments"
  ON community_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 评论作者可以删除自己的评论
CREATE POLICY "Users can delete own comments"
  ON community_comments FOR DELETE
  USING (auth.uid() = user_id);

-- 8. RLS 策略 - community_reports
-- 举报者可以查看自己的举报
CREATE POLICY "Users can view own reports"
  ON community_reports FOR SELECT
  USING (auth.uid() = reported_by);

-- 登录用户可以创建举报
CREATE POLICY "Authenticated users can create reports"
  ON community_reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- 防止重复举报（同一用户对同一评论只能举报一次）
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_reports_unique
  ON community_reports(comment_id, reported_by);
