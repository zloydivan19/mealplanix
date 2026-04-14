-- Миграция seed_dishes.ts → food_catalog
-- Запускать ПОСЛЕ migration-food-catalog.sql и seed-food-catalog.sql
-- Проверь что блюда не дублируются (по названию)

INSERT INTO public.food_catalog (name, kcal, protein, fat, carbs, category, portion_default_g, cost_per_100g, ingredients)
SELECT name, kcal, protein, fat, carbs, category, portion_default_g, cost_per_100g, ingredients
FROM (VALUES

-- ── Завтраки ─────────────────────────────────────────────────────────
('Оладьи с ветчиной и сыром', 220.0, 10.0, 12.0, 18.0, 'breakfast', 200, 42.0,
 '[{"name":"мука пшеничная","category":"grain","qty":60,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"кефир","category":"dairy","qty":150,"unit":"мл"},{"name":"ветчина","category":"meat","qty":60,"unit":"г"},{"name":"сыр твёрдый","category":"dairy","qty":40,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"разрыхлитель","category":"condiment","qty":5,"unit":"г"}]'::jsonb),

('Яичница с помидорами и ветчиной', 170.0, 9.0, 11.0, 7.0, 'breakfast', 200, 40.0,
 '[{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"помидоры","category":"vegetable","qty":80,"unit":"г"},{"name":"ветчина","category":"meat","qty":60,"unit":"г"},{"name":"масло сливочное","category":"dairy","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"зелень","category":"vegetable","qty":10,"unit":"г"}]'::jsonb),

('Сырники со сгущёнкой', 230.0, 11.0, 9.0, 25.0, 'breakfast', 200, 45.0,
 '[{"name":"творог 9%","category":"dairy","qty":150,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"мука пшеничная","category":"grain","qty":30,"unit":"г"},{"name":"сахар","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"сгущёное молоко","category":"dairy","qty":30,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"}]'::jsonb),

('Овсянка с сыром и яйцом', 130.0, 7.0, 5.0, 16.0, 'breakfast', 300, 20.0,
 '[{"name":"овсяные хлопья","category":"grain","qty":80,"unit":"г"},{"name":"молоко","category":"dairy","qty":250,"unit":"мл"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"сыр твёрдый","category":"dairy","qty":30,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"масло сливочное","category":"dairy","qty":10,"unit":"г"}]'::jsonb),

('Горячий бутерброд: колбаса + сыр', 280.0, 12.0, 14.0, 26.0, 'breakfast', 150, 50.0,
 '[{"name":"хлеб тостовый","category":"grain","qty":60,"unit":"г"},{"name":"колбаса варёная","category":"meat","qty":50,"unit":"г"},{"name":"сыр твёрдый","category":"dairy","qty":30,"unit":"г"},{"name":"масло сливочное","category":"dairy","qty":10,"unit":"г"}]'::jsonb),

('Оладьи из батата со сметаной', 175.0, 4.0, 7.0, 24.0, 'breakfast', 220, 38.0,
 '[{"name":"батат","category":"vegetable","qty":150,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"мука рисовая","category":"grain","qty":40,"unit":"г"},{"name":"сметана","category":"dairy","qty":40,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"корица","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Блин из яйца с авокадо', 185.0, 10.0, 14.0, 4.0, 'breakfast', 180, 36.0,
 '[{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"авокадо","category":"fruit","qty":1,"unit":"шт"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"},{"name":"лимонный сок","category":"condiment","qty":5,"unit":"мл"}]'::jsonb),

-- ── Основные блюда ────────────────────────────────────────────────────
('Куриное филе запечённое', 165.0, 31.0, 4.0, 0.0, 'main', 200, 55.0,
 '[{"name":"куриное филе","category":"meat","qty":220,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"паприка","category":"condiment","qty":1,"unit":"щепотка"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"},{"name":"розмарин","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Котлеты домашние', 240.0, 16.0, 16.0, 8.0, 'main', 200, 65.0,
 '[{"name":"фарш свино-говяжий","category":"meat","qty":160,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"хлеб белый","category":"grain","qty":30,"unit":"г"},{"name":"молоко","category":"dairy","qty":30,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"}]'::jsonb),

('Тушёная говядина с овощами', 145.0, 18.0, 7.0, 4.0, 'main', 200, 80.0,
 '[{"name":"говядина","category":"meat","qty":170,"unit":"г"},{"name":"морковь","category":"vegetable","qty":60,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":60,"unit":"г"},{"name":"томатная паста","category":"condiment","qty":20,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"лавровый лист","category":"condiment","qty":1,"unit":"щепотка"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Стейк индейки', 155.0, 29.0, 4.0, 0.0, 'main', 200, 70.0,
 '[{"name":"филе индейки","category":"meat","qty":220,"unit":"г"},{"name":"соевый соус","category":"condiment","qty":20,"unit":"мл"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"тимьян","category":"condiment","qty":1,"unit":"щепотка"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Запечённый лосось', 206.0, 20.0, 13.0, 0.0, 'main', 180, 120.0,
 '[{"name":"лосось","category":"meat","qty":200,"unit":"г"},{"name":"лимон","category":"fruit","qty":0.5,"unit":"шт"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"укроп","category":"vegetable","qty":10,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":5,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Биточки из индейки с цукини', 130.0, 18.0, 5.0, 5.0, 'main', 220, 60.0,
 '[{"name":"фарш из индейки","category":"meat","qty":160,"unit":"г"},{"name":"цукини","category":"vegetable","qty":80,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":40,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Запечённый батат с курицей', 140.0, 14.0, 4.0, 12.0, 'main', 220, 55.0,
 '[{"name":"куриное филе","category":"meat","qty":130,"unit":"г"},{"name":"батат","category":"vegetable","qty":130,"unit":"г"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"паприка","category":"condiment","qty":1,"unit":"щепотка"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Лепёшка из тунца', 160.0, 22.0, 5.0, 8.0, 'main', 180, 65.0,
 '[{"name":"тунец консервированный","category":"meat","qty":100,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"мука овсяная","category":"grain","qty":40,"unit":"г"},{"name":"лук зелёный","category":"vegetable","qty":20,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

-- ── Гарниры ──────────────────────────────────────────────────────────
('Гречка варёная', 110.0, 4.0, 1.0, 21.0, 'side', 180, 8.0,
 '[{"name":"гречка","category":"grain","qty":70,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Рис варёный', 130.0, 3.0, 0.0, 28.0, 'side', 180, 7.0,
 '[{"name":"рис","category":"grain","qty":70,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Макароны варёные', 150.0, 5.0, 1.0, 30.0, 'side', 180, 10.0,
 '[{"name":"макароны","category":"grain","qty":70,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Картофель варёный', 80.0, 2.0, 0.0, 17.0, 'side', 200, 6.0,
 '[{"name":"картофель","category":"vegetable","qty":250,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Картофель запечённый', 95.0, 2.0, 2.0, 18.0, 'side', 200, 7.0,
 '[{"name":"картофель","category":"vegetable","qty":250,"unit":"г"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Булгур варёный', 120.0, 4.0, 1.0, 24.0, 'side', 180, 15.0,
 '[{"name":"булгур","category":"grain","qty":70,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

-- ── Салаты ───────────────────────────────────────────────────────────
('Овощной салат (огурец + помидор)', 25.0, 1.0, 0.0, 5.0, 'salad', 150, 12.0,
 '[{"name":"огурцы","category":"vegetable","qty":70,"unit":"г"},{"name":"помидоры","category":"vegetable","qty":70,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Греческий салат', 90.0, 4.0, 7.0, 4.0, 'salad', 150, 30.0,
 '[{"name":"помидоры","category":"vegetable","qty":50,"unit":"г"},{"name":"огурцы","category":"vegetable","qty":40,"unit":"г"},{"name":"перец болгарский","category":"vegetable","qty":30,"unit":"г"},{"name":"маслины","category":"other","qty":20,"unit":"г"},{"name":"сыр фета","category":"dairy","qty":40,"unit":"г"},{"name":"оливковое масло","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Капустный салат', 30.0, 1.0, 0.0, 6.0, 'salad', 150, 8.0,
 '[{"name":"капуста белокочанная","category":"vegetable","qty":110,"unit":"г"},{"name":"морковь","category":"vegetable","qty":30,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"уксус","category":"condiment","qty":5,"unit":"мл"}]'::jsonb),

('Морковный салат с маслом', 55.0, 1.0, 3.0, 7.0, 'salad', 120, 8.0,
 '[{"name":"морковь","category":"vegetable","qty":100,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"чеснок","category":"vegetable","qty":5,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Свекольный салат', 50.0, 1.0, 2.0, 8.0, 'salad', 120, 7.0,
 '[{"name":"свёкла","category":"vegetable","qty":100,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":5,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

-- ── Перекусы ─────────────────────────────────────────────────────────
('Яблоко + горсть орехов', 160.0, 3.0, 9.0, 18.0, 'snack', 130, 35.0,
 '[{"name":"яблоко","category":"fruit","qty":1,"unit":"шт"},{"name":"грецкие орехи","category":"other","qty":30,"unit":"г"}]'::jsonb),

('Творог с мёдом', 145.0, 14.0, 4.0, 13.0, 'snack', 150, 37.0,
 '[{"name":"творог 9%","category":"dairy","qty":130,"unit":"г"},{"name":"мёд","category":"other","qty":20,"unit":"г"}]'::jsonb),

('Банан + арахисовая паста', 200.0, 5.0, 8.0, 28.0, 'snack', 130, 38.0,
 '[{"name":"банан","category":"fruit","qty":1,"unit":"шт"},{"name":"арахисовая паста","category":"other","qty":30,"unit":"г"}]'::jsonb),

('Кефир с огурцом', 45.0, 3.0, 2.0, 5.0, 'snack', 250, 12.0,
 '[{"name":"кефир","category":"dairy","qty":200,"unit":"мл"},{"name":"огурцы","category":"vegetable","qty":60,"unit":"г"}]'::jsonb),

('Хлебцы с авокадо', 210.0, 4.0, 11.0, 24.0, 'snack', 100, 65.0,
 '[{"name":"хлебцы","category":"grain","qty":40,"unit":"г"},{"name":"авокадо","category":"fruit","qty":0.5,"unit":"шт"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'::jsonb),

('Греческий йогурт с ягодами', 100.0, 8.0, 3.0, 11.0, 'snack', 200, 35.0,
 '[{"name":"греческий йогурт","category":"dairy","qty":170,"unit":"г"},{"name":"ягоды","category":"fruit","qty":40,"unit":"г"}]'::jsonb),

('Сыр + виноград', 200.0, 9.0, 14.0, 11.0, 'snack', 100, 55.0,
 '[{"name":"сыр твёрдый","category":"dairy","qty":60,"unit":"г"},{"name":"виноград","category":"fruit","qty":50,"unit":"г"}]'::jsonb)

) AS t(name, kcal, protein, fat, carbs, category, portion_default_g, cost_per_100g, ingredients)
-- Не вставлять если блюдо с таким именем уже есть
WHERE NOT EXISTS (
  SELECT 1 FROM public.food_catalog fc WHERE fc.name = t.name
);
