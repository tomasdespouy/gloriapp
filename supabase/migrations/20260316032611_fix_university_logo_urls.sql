-- Fix logo_url paths for universities to use local /universities/ or /branding/ directory
-- Match by slug OR name pattern to be resilient to slug variations

UPDATE public.establishments SET logo_url = '/universities/unicaribe.png'
  WHERE slug = 'unicaribe' OR LOWER(name) LIKE '%unicaribe%' OR LOWER(name) LIKE '%caribe%';

UPDATE public.establishments SET logo_url = '/universities/upc-peru.png'
  WHERE slug = 'upc-peru' OR slug = 'upc' OR LOWER(name) LIKE '%upc%' OR LOWER(name) LIKE '%ciencias aplicadas%';

UPDATE public.establishments SET logo_url = '/universities/usmp.png'
  WHERE slug = 'usmp' OR LOWER(name) LIKE '%usmp%' OR LOWER(name) LIKE '%san mart%n de porres%';

UPDATE public.establishments SET logo_url = '/universities/usb-cali.png'
  WHERE slug = 'usb-cali' OR slug = 'usb' OR LOWER(name) LIKE '%buenaventura%';

UPDATE public.establishments SET logo_url = '/branding/ugm-logo.png'
  WHERE slug = 'ugm' OR LOWER(name) LIKE '%gabriela mistral%';
