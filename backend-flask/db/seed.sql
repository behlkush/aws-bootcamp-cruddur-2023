-- this file was manually created
INSERT INTO public.users (display_name, email, handle, cognito_user_id)
VALUES
  ('Kiaan Behl', 'behlkiaan@gmail.com', 'behlkiaan' ,'MOCK'),
  ('Owen Sound', 'kushbehl@gmail.com', 'owensound' ,'MOCK');

INSERT INTO public.activities (user_uuid, message, expires_at)
VALUES
  (
    (SELECT uuid from public.users WHERE users.handle = 'owensound' LIMIT 1),
    'This was imported as seed data!',
    current_timestamp + interval '10 day'
  )