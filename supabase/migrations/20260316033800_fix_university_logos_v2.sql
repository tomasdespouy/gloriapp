-- Fix logo_url using exact names visible in the UI
-- Using ILIKE for accent-insensitive matching

UPDATE public.establishments SET logo_url = '/universities/usb-cali.png'
  WHERE name ILIKE '%San Buenaventura%';

UPDATE public.establishments SET logo_url = '/universities/upc-peru.png'
  WHERE name ILIKE '%Ciencias Aplicadas%';

UPDATE public.establishments SET logo_url = '/universities/usmp.png'
  WHERE name ILIKE '%San Martin de Porres%' OR name ILIKE '%San Martín de Porres%';

UPDATE public.establishments SET logo_url = '/universities/unicaribe.png'
  WHERE name ILIKE '%del Caribe%' OR name ILIKE '%unicaribe%';

UPDATE public.establishments SET logo_url = '/branding/ugm-logo.png'
  WHERE name ILIKE '%Gabriela Mistral%';
