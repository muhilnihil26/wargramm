-- Keep the listed Google accounts matched to readable profiles and turn
-- story/reel features on for new deployments.

WITH user_names(email, username, full_name) AS (
  VALUES
    ('infantjeril442@gmail.com', 'infantjeril442', 'Infant Jeril'),
    ('nihilyadesh2015@gmail.com', 'nihilyadesh2015', 'Nihil Yadesh'),
    ('sanjanashreer682@gmail.com', 'sanjanashreer682', 'Sanjana Shree'),
    ('mithresh0205@gmail.com', 'mithresh0205', 'Mithresh'),
    ('yazhinimanikumar@gmail.com', 'yazhinimanikumar', 'Yazhini Manikumar'),
    ('mmugeshdharan@gmail.com', 'mmugeshdharan', 'M Mugesh Dharan'),
    ('5b.vrrithikamfts@gmail.com', 'vrrithikamfts', 'Vrrithika'),
    ('ananya2505123456@gmail.com', 'ananya2505123456', 'Ananya'),
    ('dharunashok011@gmail.com', 'dharunashok011', 'Dharun Ashok'),
    ('tamilselvanask7@gmail.com', 'tamilselvanask7', 'Tamil Selvan'),
    ('muhilsiddhesh.in@gmail.com', 'muhilsiddhesh', 'Muhil Siddhesh')
),
matched AS (
  SELECT u.id AS user_id, n.username, n.full_name
  FROM auth.users u
  JOIN user_names n ON lower(u.email) = lower(n.email)
)
INSERT INTO public.profiles (user_id, username, full_name, avatar_url)
SELECT user_id, username, full_name, ''
FROM matched
ON CONFLICT (user_id) DO UPDATE
SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  updated_at = now();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE lower(email) = 'muhilsiddhesh.in@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.admin_settings (key, value)
VALUES
  ('firebase_admin_uid', 'nxANfkUL63MSTv300eH6rSICw9w1'),
  ('admin_email', 'muhilsiddhesh.in@gmail.com'),
  ('flag_reels', 'true'),
  ('flag_stories', 'true')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
