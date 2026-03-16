-- Fix logo_url paths for universities to use /universities/ directory
-- Match by slug OR name pattern to be resilient to slug variations
UPDATE public.establishments SET logo_url = '/universities/unicaribe.png'
  WHERE slug = 'unicaribe' OR LOWER(name) LIKE '%unicaribe%';

UPDATE public.establishments SET logo_url = '/universities/upc-peru.png'
  WHERE slug = 'upc-peru' OR slug = 'upc' OR LOWER(name) LIKE '%upc%';

UPDATE public.establishments SET logo_url = '/universities/usmp.png'
  WHERE slug = 'usmp' OR LOWER(name) LIKE '%usmp%' OR LOWER(name) LIKE '%san mart%';

UPDATE public.establishments SET logo_url = '/universities/usb-cali.png'
  WHERE slug = 'usb-cali' OR slug = 'usb' OR LOWER(name) LIKE '%usb%cali%' OR LOWER(name) LIKE '%san buenaventura%cali%';
