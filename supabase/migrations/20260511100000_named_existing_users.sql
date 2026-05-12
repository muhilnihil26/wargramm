-- Match existing Google users to readable profile names.
-- Password changes for Google-provider accounts must be done in Firebase Admin,
-- not in profile rows.

WITH user_names(email, username, full_name) AS (
  VALUES
    ('infantjeril442@gmail.com', 'infantjeril442', 'Infant Jeril'),
    ('nihilyadesh2015@gmail.com', 'nihilyadesh2015', 'Nihil Yadesh'),
    ('sanjanashreer682@gmail.com', 'sanjanashreer682', 'Sanjana Shreer'),
    ('mithresh0205@gmail.com', 'mithresh0205', 'Mithresh'),
    ('yazhinimanikumar@gmail.com', 'yazhinimanikumar', 'Yazhini Manikumar'),
    ('mmugeshdharan@gmail.com', 'mmugeshdharan', 'M Mugesh Dharan'),
    ('5b.vrrithikamfts@gmail.com', '5b.vrrithikamfts', 'Vrrithika'),
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
