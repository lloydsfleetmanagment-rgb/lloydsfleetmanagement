INSERT INTO public.destinations (code, name, material_code, sort_order, is_crusher) VALUES
 ('1030-H-8','H-8','10*30',6,false),
 ('1030-H-5','H-5','10*30',7,false),
 ('1030-H-4','H-4','10*30',8,false),
 ('1030-RECLAIMER-4','Reclaimer 4','10*30',9,false),
 ('1030-RECLAIMER-5','Reclaimer 5','10*30',10,false),
 ('40P-PROPEL','PROPEL','40+',1,false),
 ('40P-SANDVIK-350','SANDVIK-350','40+',2,false),
 ('40P-PUZZULONA','PUZZULONA','40+',3,false),
 ('40P-METSO','METSO','40+',4,false),
 ('40P-STOCK-TOP','STOCK TOP','40+',5,false),
 ('40P-STOCK-BOTTOM','STOCK BOTTOM','40+',6,false)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, material_code = EXCLUDED.material_code, sort_order = EXCLUDED.sort_order, is_crusher = EXCLUDED.is_crusher;

DELETE FROM public.destinations
WHERE code IN ('40P-SBD','40P-TH-1','40P-TH-2','40P-TH-3','40P-TH-4','40P-TH-5')
  AND NOT EXISTS (SELECT 1 FROM public.operator_logs ol WHERE ol.destination_code = destinations.code)
  AND NOT EXISTS (SELECT 1 FROM public.production_entries pe WHERE pe.destination_code = destinations.code);

UPDATE public.destinations SET sort_order = 90 WHERE code IN ('BHQ Dump','Shale Dump Top');