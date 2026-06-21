-- 为 community_posts 表增加第二张服装图和试穿模式字段
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS clothing2_image_url TEXT,
  ADD COLUMN IF NOT EXISTS tryon_mode TEXT DEFAULT 'single';
