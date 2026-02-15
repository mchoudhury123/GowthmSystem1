-- Growthm Seed Data
-- Run this after schema.sql to populate with demo data

-- Insert demo creator
INSERT INTO creators (id, handle, niche, created_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '@contentcreator', 'productivity', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Insert 30 videos (remove id column, let DB generate UUIDs)
INSERT INTO videos (creator_id, tiktok_id, caption, thumb_url, duration_s, views, likes, comments, created_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000001', 'Ever wonder why you can''t focus? Here''s the truth nobody tells you...', 'https://via.placeholder.com/300x400', 14, 125000, 8200, 340, NOW() - INTERVAL '1 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000002', 'I built a $10k/mo side hustle in 90 days. Here''s the blueprint.', 'https://via.placeholder.com/300x400', 19, 98000, 7100, 290, NOW() - INTERVAL '2 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000003', 'The story of how I went from broke to 6 figures changed everything...', 'https://via.placeholder.com/300x400', 43, 45000, 2300, 120, NOW() - INTERVAL '3 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000004', 'Problem: You''re wasting time. Solution: This productivity hack.', 'https://via.placeholder.com/300x400', 31, 18000, 890, 45, NOW() - INTERVAL '4 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000005', 'What if I told you morning routines are overrated?', 'https://via.placeholder.com/300x400', 17, 142000, 11200, 520, NOW() - INTERVAL '5 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000006', '99% of productivity advice is wrong. Here''s why.', 'https://via.placeholder.com/300x400', 34, 67000, 4200, 180, NOW() - INTERVAL '6 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000007', 'Some random thoughts about productivity and life balance...', 'https://via.placeholder.com/300x400', 47, 12000, 520, 32, NOW() - INTERVAL '7 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000008', 'Should you quit your job? Ask yourself this ONE question first.', 'https://via.placeholder.com/300x400', 16, 156000, 13400, 670, NOW() - INTERVAL '8 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000009', 'Nobody talks about this, but it''s the #1 productivity killer.', 'https://via.placeholder.com/300x400', 21, 89000, 6700, 310, NOW() - INTERVAL '9 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000010', 'The day I realized hard work isn''t enough...', 'https://via.placeholder.com/300x400', 29, 51000, 3200, 140, NOW() - INTERVAL '10 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000011', 'Why do successful people wake up at 5am?', 'https://via.placeholder.com/300x400', 13, 178000, 15600, 890, NOW() - INTERVAL '11 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000012', 'Problem: No time. Solution: Time blocking.', 'https://via.placeholder.com/300x400', 22, 23000, 1100, 67, NOW() - INTERVAL '12 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000013', 'This ONE hack doubled my output overnight.', 'https://via.placeholder.com/300x400', 18, 112000, 8900, 410, NOW() - INTERVAL '13 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000014', 'Are you making this common productivity mistake?', 'https://via.placeholder.com/300x400', 12, 94000, 7200, 320, NOW() - INTERVAL '14 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000015', 'How do you stay motivated? Here''s the real answer.', 'https://via.placeholder.com/300x400', 19, 167000, 14100, 720, NOW() - INTERVAL '15 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000016', 'Video caption 16 - analysis pending', 'https://via.placeholder.com/300x400', 23, 54000, 3200, 120, NOW() - INTERVAL '16 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000017', 'Video caption 17 - analysis pending', 'https://via.placeholder.com/300x400', 18, 67000, 4100, 180, NOW() - INTERVAL '17 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000018', 'Video caption 18 - analysis pending', 'https://via.placeholder.com/300x400', 27, 42000, 2800, 95, NOW() - INTERVAL '18 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000019', 'Video caption 19 - analysis pending', 'https://via.placeholder.com/300x400', 15, 89000, 6200, 250, NOW() - INTERVAL '19 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000020', 'Video caption 20 - analysis pending', 'https://via.placeholder.com/300x400', 31, 38000, 1900, 78, NOW() - INTERVAL '20 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000021', 'Video caption 21 - analysis pending', 'https://via.placeholder.com/300x400', 19, 72000, 5100, 210, NOW() - INTERVAL '21 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000022', 'Video caption 22 - analysis pending', 'https://via.placeholder.com/300x400', 25, 51000, 3400, 140, NOW() - INTERVAL '22 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000023', 'Video caption 23 - analysis pending', 'https://via.placeholder.com/300x400', 16, 95000, 7800, 320, NOW() - INTERVAL '23 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000024', 'Video caption 24 - analysis pending', 'https://via.placeholder.com/300x400', 21, 63000, 4500, 190, NOW() - INTERVAL '24 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000025', 'Video caption 25 - analysis pending', 'https://via.placeholder.com/300x400', 29, 47000, 2900, 110, NOW() - INTERVAL '25 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000026', 'Video caption 26 - analysis pending', 'https://via.placeholder.com/300x400', 14, 81000, 6100, 270, NOW() - INTERVAL '26 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000027', 'Video caption 27 - analysis pending', 'https://via.placeholder.com/300x400', 22, 58000, 3800, 150, NOW() - INTERVAL '27 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000028', 'Video caption 28 - analysis pending', 'https://via.placeholder.com/300x400', 17, 92000, 7400, 310, NOW() - INTERVAL '28 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000029', 'Video caption 29 - analysis pending', 'https://via.placeholder.com/300x400', 26, 44000, 2700, 98, NOW() - INTERVAL '29 days'),
  ('550e8400-e29b-41d4-a716-446655440000', '7123456789000000030', 'Video caption 30 - analysis pending', 'https://via.placeholder.com/300x400', 20, 76000, 5500, 220, NOW() - INTERVAL '30 days')
ON CONFLICT (tiktok_id) DO NOTHING;

-- Insert 15 video insights (using tiktok_id to find video_id)
WITH video_refs AS (
  SELECT id, tiktok_id FROM videos WHERE creator_id = '550e8400-e29b-41d4-a716-446655440000'
)
INSERT INTO video_insights (video_id, verdict, why_json, next_action, labels_json, created_at)
SELECT
  v.id,
  insights.verdict::TEXT,
  insights.why_json::JSONB,
  insights.next_action::TEXT,
  insights.labels_json::JSONB,
  insights.created_at::TIMESTAMPTZ
FROM video_refs v
INNER JOIN (VALUES
  ('7123456789000000001', 'REPEAT', '["Hook question format drives 3x more retention", "Under 20s keeps viewer attention peak", "Early CTA placement converts better"]', 'Create 3 more videos with question hooks under 20 seconds', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "<15"}', NOW() - INTERVAL '1 days'),
  ('7123456789000000002', 'REPEAT', '["Bold claim hook stops scrolling immediately", "B-roll montage style matches your best performers", "Mid-video CTA feels natural in this format"]', 'Double down on bold claims + b-roll montage combos', '{"hook_type": "BOLD_CLAIM", "format": "BROLL", "cta_timing": "MID", "length_bucket": "15-25"}', NOW() - INTERVAL '2 days'),
  ('7123456789000000003', 'MODIFY', '["Story hook works but needs faster pacing", "40+ seconds loses 60% of viewers", "Late CTA misses engagement window"]', 'Trim story hooks to 15-20s and move CTA earlier', '{"hook_type": "STORY", "format": "MIXED", "cta_timing": "LATE", "length_bucket": "40+"}', NOW() - INTERVAL '3 days'),
  ('7123456789000000004', 'STOP', '["Problem-solution format underperforms in your niche", "Text-on-screen style gets low engagement", "No CTA means no conversion"]', 'Abandon this format entirely - stick to talking head', '{"hook_type": "PROBLEM_SOLUTION", "format": "TEXT_ON_SCREEN", "cta_timing": "NONE", "length_bucket": "25-40"}', NOW() - INTERVAL '4 days'),
  ('7123456789000000005', 'REPEAT', '["Question hooks proven to be your top performer", "Talking head builds authentic connection", "Early CTA capitalizes on peak attention"]', 'Make this your default template for next 5 videos', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "15-25"}', NOW() - INTERVAL '5 days'),
  ('7123456789000000006', 'MODIFY', '["Bold claim is strong but video runs too long", "Montage could work with tighter editing"]', 'Keep hook, cut 15 seconds from middle section', '{"hook_type": "BOLD_CLAIM", "format": "MONTAGE", "cta_timing": "MID", "length_bucket": "25-40"}', NOW() - INTERVAL '6 days'),
  ('7123456789000000007', 'STOP', '["Generic hook fails to differentiate", "Mixed format feels disjointed"]', 'Stop experimenting with mixed styles - pick one format', '{"hook_type": "OTHER", "format": "MIXED", "cta_timing": "LATE", "length_bucket": "40+"}', NOW() - INTERVAL '7 days'),
  ('7123456789000000008', 'REPEAT', '["Question + talking head = proven winner", "15-20s sweet spot confirmed again"]', 'Batch record 10 more question-hook videos', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "15-25"}', NOW() - INTERVAL '8 days'),
  ('7123456789000000009', 'REPEAT', '["Bold claim hooks perform consistently well", "B-roll adds production value without losing authenticity"]', 'Schedule 2 bold claim videos per week', '{"hook_type": "BOLD_CLAIM", "format": "BROLL", "cta_timing": "MID", "length_bucket": "15-25"}', NOW() - INTERVAL '9 days'),
  ('7123456789000000010', 'MODIFY', '["Story hook has potential but pacing is off", "Needs tighter editing"]', 'Re-edit with 30% faster cuts', '{"hook_type": "STORY", "format": "TALKING_HEAD", "cta_timing": "MID", "length_bucket": "25-40"}', NOW() - INTERVAL '10 days'),
  ('7123456789000000011', 'REPEAT', '["Question format continues to dominate", "Viewers love quick, actionable content"]', 'Keep question hooks as primary strategy', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "<15"}', NOW() - INTERVAL '11 days'),
  ('7123456789000000012', 'STOP', '["Problem-solution doesn''t resonate with your audience", "Text-based content underperforms"]', 'Stick to face-to-camera content', '{"hook_type": "PROBLEM_SOLUTION", "format": "TEXT_ON_SCREEN", "cta_timing": "NONE", "length_bucket": "15-25"}', NOW() - INTERVAL '12 days'),
  ('7123456789000000013', 'REPEAT', '["Bold claims drive clicks and shares", "B-roll montage style scales well"]', 'Build a library of b-roll for faster production', '{"hook_type": "BOLD_CLAIM", "format": "BROLL", "cta_timing": "MID", "length_bucket": "15-25"}', NOW() - INTERVAL '13 days'),
  ('7123456789000000014', 'MODIFY', '["Question hook is good but delivery feels rushed", "Slow down pace slightly"]', 'Re-record with 10% slower delivery', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "<15"}', NOW() - INTERVAL '14 days'),
  ('7123456789000000015', 'REPEAT', '["Question + talking head continues to win", "15-20s length is the goldilocks zone"]', 'Make this your default daily format', '{"hook_type": "QUESTION", "format": "TALKING_HEAD", "cta_timing": "EARLY", "length_bucket": "15-25"}', NOW() - INTERVAL '15 days')
) AS insights(tiktok_id, verdict, why_json, next_action, labels_json, created_at)
ON v.tiktok_id = insights.tiktok_id
ON CONFLICT (video_id) DO NOTHING;

-- Insert weekly summary (remove id, let DB generate UUID)
INSERT INTO weekly_summary (creator_id, do_more_json, stop_doing_json, created_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000',
   '["Question hooks - 70% of your top performers use them", "Talking head format - authentic connection drives engagement", "15-20 second videos - sweet spot for retention and completion", "Early CTAs - capture attention in first 5 seconds"]'::JSONB,
   '["Text-on-screen content - underperforms by 65%", "Videos over 30 seconds - lose majority of viewers", "Problem-solution format - doesn''t resonate with your audience"]'::JSONB,
   NOW())
ON CONFLICT (creator_id) DO UPDATE SET
  do_more_json = EXCLUDED.do_more_json,
  stop_doing_json = EXCLUDED.stop_doing_json,
  created_at = EXCLUDED.created_at;

-- Verify the seed data
SELECT 'Seed complete!' as status,
  (SELECT COUNT(*) FROM creators) as creators_count,
  (SELECT COUNT(*) FROM videos) as videos_count,
  (SELECT COUNT(*) FROM video_insights) as insights_count,
  (SELECT COUNT(*) FROM weekly_summary) as summaries_count;
