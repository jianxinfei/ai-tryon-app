-- 为 community_posts 表增加人物图和衣物图字段
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS person_image_url TEXT,
  ADD COLUMN IF NOT EXISTS clothing_image_url TEXT;
