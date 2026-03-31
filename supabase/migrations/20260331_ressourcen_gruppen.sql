-- Ressourcen-Gruppen: Dynamische Gruppierung fuer Kalender-Filter
-- Werte: 'monteur', 'geschaeftsfuehrung', 'buero' (erweiterbar)
-- Applied via CLI

-- 1. Neue Spalte
ALTER TABLE public.ressourcen ADD COLUMN IF NOT EXISTS gruppe TEXT;

-- 2. Standard-Monteure
UPDATE public.ressourcen SET gruppe = 'monteur'
WHERE typ = 'monteur' AND kuerzel IN ('MA', 'MF', 'CH', 'MI', 'ST');

-- 3. Geschaeftsfuehrung (Andreas + Jaroslaw)
UPDATE public.ressourcen SET gruppe = 'geschaeftsfuehrung'
WHERE typ = 'monteur' AND kuerzel IN ('AN', 'JA');

-- 4. Buero (leer, spaeter zu befuellen)
-- INSERT: Wenn Buero-Mitarbeiter als Ressourcen angelegt werden,
-- einfach typ='monteur' (oder neuer typ='buero') + gruppe='buero' setzen
