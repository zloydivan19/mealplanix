-- Миграция: добавить фото в food_catalog
-- Запустить в Supabase SQL editor

ALTER TABLE food_catalog ADD COLUMN IF NOT EXISTS photo text;

UPDATE food_catalog SET photo = '/photodishes/yaichnitsa.png'        WHERE name ILIKE '%яичниц%' AND name NOT ILIKE '%помидор%' AND name NOT ILIKE '%томат%' AND name NOT ILIKE '%ветчин%';
UPDATE food_catalog SET photo = '/photodishes/yaichnitsa-1.png'      WHERE name ILIKE '%яичниц%' AND (name ILIKE '%помидор%' OR name ILIKE '%томат%' OR name ILIKE '%ветчин%');
UPDATE food_catalog SET photo = '/photodishes/ovsyanka.png'          WHERE name ILIKE '%овсян%';
UPDATE food_catalog SET photo = '/photodishes/blin-iz-yaytsa.png'   WHERE name ILIKE '%блин%';
UPDATE food_catalog SET photo = '/photodishes/syrniki.png'           WHERE name ILIKE '%сырник%';
UPDATE food_catalog SET photo = '/photodishes/oladi-batat.png'       WHERE name ILIKE '%оладь%' AND name ILIKE '%батат%';
UPDATE food_catalog SET photo = '/photodishes/oladi.png'             WHERE name ILIKE '%оладь%' AND name NOT ILIKE '%батат%';
UPDATE food_catalog SET photo = '/photodishes/buterbrod.png'         WHERE name ILIKE '%бутерброд%';
UPDATE food_catalog SET photo = '/photodishes/steyk-indeyki.png'     WHERE name ILIKE '%индейк%';
UPDATE food_catalog SET photo = '/photodishes/kurinaya-grudka.png'   WHERE name ILIKE '%курин%грудк%' OR name ILIKE '%грудк%курин%';
UPDATE food_catalog SET photo = '/photodishes/tushenaya-govyadina.png' WHERE name ILIKE '%говядин%';
UPDATE food_catalog SET photo = '/photodishes/kotlety-s-makaronami.png' WHERE name ILIKE '%котлет%' AND name ILIKE '%макарон%';
UPDATE food_catalog SET photo = '/photodishes/bitochki-salat.png'    WHERE name ILIKE '%биточк%';
UPDATE food_catalog SET photo = '/photodishes/pasta-s-ryboy.png'     WHERE name ILIKE '%паста%' AND name ILIKE '%рыб%';
UPDATE food_catalog SET photo = '/photodishes/zapechennyy-batat.png' WHERE name ILIKE '%батат%' AND name NOT ILIKE '%оладь%';

-- Проверка
SELECT id, name, photo FROM food_catalog ORDER BY name;
