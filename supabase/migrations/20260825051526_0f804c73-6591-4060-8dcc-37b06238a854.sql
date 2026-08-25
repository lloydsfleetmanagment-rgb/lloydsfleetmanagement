INSERT INTO public.materials (code, name, sort_order) VALUES ('R-ROM', 'Rehandling ROM', 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.destinations (code, name, material_code, allowed_equipment_types, is_crusher, sort_order) VALUES
  ('1030-PROPEL-SCREENING', 'Propel Screening Plant', '10*30', ARRAY['DUMPER','SANY'], false, 11),
  ('518-STOCK', 'Stock', '5-18', ARRAY['DUMPER','SANY'], false, 2),
  ('RROM-TH-1', 'TH-1', 'R-ROM', ARRAY['DUMPER','SANY'], false, 1),
  ('RROM-TH-2', 'TH-2', 'R-ROM', ARRAY['SANY'], false, 2),
  ('RROM-TH-3', 'TH-3', 'R-ROM', ARRAY['SANY'], false, 3),
  ('RROM-TH-4', 'TH-4', 'R-ROM', ARRAY['DUMPER','SANY'], false, 4),
  ('RROM-TH-5', 'TH-5', 'R-ROM', ARRAY['DUMPER','SANY'], false, 5),
  ('RROM-PROPEL', 'PROPEL', 'R-ROM', ARRAY['DUMPER','SANY'], false, 10),
  ('RROM-H-4', 'H-4', 'R-ROM', ARRAY['DUMPER','SANY'], false, 11),
  ('RROM-H-5', 'H-5', 'R-ROM', ARRAY['DUMPER','SANY'], false, 12),
  ('RROM-H-8', 'H-8', 'R-ROM', ARRAY['DUMPER','SANY'], false, 13),
  ('RROM-STOCK', 'STOCK', 'R-ROM', ARRAY['DUMPER','SANY'], false, 14)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.operator_logs ADD COLUMN IF NOT EXISTS client_id text;
CREATE UNIQUE INDEX IF NOT EXISTS operator_logs_client_id_key ON public.operator_logs (client_id) WHERE client_id IS NOT NULL;