-- 创建 tryon_callback_results 表，用于存储可灵 AI 回调结果
CREATE TABLE IF NOT EXISTS tryon_callback_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE NOT NULL,
  task_status TEXT NOT NULL,
  result_image_url TEXT,
  task_status_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tryon_callback_results_task_id ON tryon_callback_results(task_id);

-- 不启用 RLS，因为回调接口使用 service role key
