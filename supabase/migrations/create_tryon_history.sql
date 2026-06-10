-- ============================================================
-- 试衣历史记录表
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

CREATE TABLE IF NOT EXISTS tryon_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_image_url TEXT NOT NULL,
  clothing_image_url TEXT NOT NULL,
  result_image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 为 user_id 创建索引，加速按用户查询
CREATE INDEX IF NOT EXISTS idx_tryon_history_user_id ON tryon_history(user_id);

-- 为 created_at 创建索引，加速按时间排序
CREATE INDEX IF NOT EXISTS idx_tryon_history_created_at ON tryon_history(created_at DESC);

-- 启用 RLS（行级安全）
ALTER TABLE tryon_history ENABLE ROW LEVEL SECURITY;

-- 策略：用户只能查看自己的试衣记录
CREATE POLICY "Users can view their own tryon history"
  ON tryon_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- 策略：用户只能插入自己的试衣记录
CREATE POLICY "Users can insert their own tryon history"
  ON tryon_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 策略：用户只能删除自己的试衣记录
CREATE POLICY "Users can delete their own tryon history"
  ON tryon_history
  FOR DELETE
  USING (auth.uid() = user_id);
