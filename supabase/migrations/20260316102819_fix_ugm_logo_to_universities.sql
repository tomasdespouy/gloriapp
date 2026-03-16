-- Fix UGM logo_url to use /universities/ path consistently
UPDATE public.establishments SET logo_url = '/universities/ugm.png'
  WHERE name ILIKE '%Gabriela Mistral%';
