-- Дополнительные фото — запустить после migration-dish-photos.sql

-- Котлеты (без макарон в имени)
UPDATE food_catalog SET photo = '/photodishes/kotlety-s-makaronami.png'
WHERE name ILIKE '%котлет%' AND photo IS NULL;

-- Тефтели → похожи на биточки
UPDATE food_catalog SET photo = '/photodishes/bitochki-salat.png'
WHERE name ILIKE '%тефтел%';

-- Куриное филе / бёдра → куриная грудка
UPDATE food_catalog SET photo = '/photodishes/kurinaya-grudka.png'
WHERE name ILIKE '%курин%' AND photo IS NULL;

-- Омлет → яичница (яичное блюдо)
UPDATE food_catalog SET photo = '/photodishes/yaichnitsa-1.png'
WHERE name ILIKE '%омлет%';

-- Варёное яйцо → яичница
UPDATE food_catalog SET photo = '/photodishes/yaichnitsa.png'
WHERE name ILIKE '%яйц%' AND photo IS NULL;

-- Рыба и лосось → паста с рыбой (ближайшее рыбное фото)
UPDATE food_catalog SET photo = '/photodishes/pasta-s-ryboy.png'
WHERE (name ILIKE '%рыб%' OR name ILIKE '%лосось%' OR name ILIKE '%тунец%' OR name ILIKE '%тунц%') AND photo IS NULL;

-- Макароны / паста → котлеты с макаронами
UPDATE food_catalog SET photo = '/photodishes/kotlety-s-makaronami.png'
WHERE name ILIKE '%макарон%' AND photo IS NULL;

-- Свинина тушёная / запечённая → говядина (похожая текстура)
UPDATE food_catalog SET photo = '/photodishes/tushenaya-govyadina.png'
WHERE name ILIKE '%свинин%';

-- Проверка итога
SELECT id, name, photo FROM food_catalog WHERE photo IS NOT NULL ORDER BY name;
SELECT COUNT(*) as total, COUNT(photo) as with_photo FROM food_catalog;
