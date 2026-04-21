-- Seed: 50 российских блюд с КБЖУ и ингредиентами
-- Источник: Таблицы химического состава продуктов (Скурихин, Тутельян)
-- category: meal slot (breakfast | main | side | salad | snack)
-- ingredients[].category: shopping category (meat | dairy | grain | vegetable | fruit | condiment | other)
-- ingredients[].qty: количество на одну стандартную порцию
-- ingredients[].unit: г | мл | шт | щепотка

INSERT INTO public.food_catalog (name, kcal, protein, fat, carbs, category, portion_default_g, cost_per_100g, standalone, ingredients) VALUES

-- ── Завтраки ─────────────────────────────────────────────────────────
('Овсяная каша на молоке', 130.0, 4.5, 3.8, 19.5, 'breakfast', 250, 8.0, false,
 '[{"name":"овсяные хлопья","category":"grain","qty":80,"unit":"г"},{"name":"молоко","category":"dairy","qty":200,"unit":"мл"},{"name":"сахар","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Омлет с помидорами', 145.0, 10.5, 10.2, 3.5, 'breakfast', 180, 22.0, false,
 '[{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"молоко","category":"dairy","qty":50,"unit":"мл"},{"name":"помидоры","category":"vegetable","qty":100,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Творог со сметаной', 160.0, 15.0, 9.5, 4.5, 'breakfast', 200, 30.0, false,
 '[{"name":"творог","category":"dairy","qty":150,"unit":"г"},{"name":"сметана","category":"dairy","qty":40,"unit":"г"},{"name":"сахар","category":"condiment","qty":10,"unit":"г"}]'),

('Гречневая каша с маслом', 142.0, 4.8, 4.2, 22.0, 'breakfast', 200, 10.0, false,
 '[{"name":"гречка","category":"grain","qty":80,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Яичница с беконом', 280.0, 16.5, 22.5, 1.5, 'breakfast', 150, 45.0, false,
 '[{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"бекон","category":"meat","qty":60,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Сырники со сметаной', 220.0, 13.5, 8.5, 24.0, 'breakfast', 200, 35.0, false,
 '[{"name":"творог","category":"dairy","qty":150,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"мука пшеничная","category":"grain","qty":30,"unit":"г"},{"name":"сахар","category":"condiment","qty":15,"unit":"г"},{"name":"сметана","category":"dairy","qty":30,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"}]'),

('Блины на молоке', 210.0, 6.5, 7.5, 30.0, 'breakfast', 200, 18.0, false,
 '[{"name":"мука пшеничная","category":"grain","qty":100,"unit":"г"},{"name":"молоко","category":"dairy","qty":300,"unit":"мл"},{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"масло сливочное","category":"condiment","qty":20,"unit":"г"},{"name":"сахар","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Бутерброд с сыром и маслом', 310.0, 12.0, 18.5, 26.0, 'breakfast', 120, 40.0, false,
 '[{"name":"хлеб пшеничный","category":"grain","qty":80,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":15,"unit":"г"},{"name":"сыр российский","category":"dairy","qty":40,"unit":"г"}]'),

('Мюсли с йогуртом', 195.0, 7.5, 4.5, 32.0, 'breakfast', 200, 35.0, false,
 '[{"name":"мюсли","category":"grain","qty":80,"unit":"г"},{"name":"йогурт натуральный","category":"dairy","qty":150,"unit":"мл"},{"name":"банан","category":"fruit","qty":1,"unit":"шт"}]'),

('Пшённая каша на молоке', 135.0, 4.8, 3.5, 22.0, 'breakfast', 250, 9.0, false,
 '[{"name":"пшено","category":"grain","qty":80,"unit":"г"},{"name":"молоко","category":"dairy","qty":200,"unit":"мл"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"сахар","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

-- ── Основные блюда ────────────────────────────────────────────────────
('Котлеты домашние', 220.0, 14.6, 14.1, 9.0, 'main', 200, 55.0, false,
 '[{"name":"фарш свиной","category":"meat","qty":80,"unit":"г"},{"name":"фарш говяжий","category":"meat","qty":80,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"хлеб белый","category":"grain","qty":30,"unit":"г"},{"name":"молоко","category":"dairy","qty":30,"unit":"мл"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Куриное филе запечённое', 165.0, 28.5, 5.5, 1.5, 'main', 200, 60.0, false,
 '[{"name":"куриное филе","category":"meat","qty":220,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"},{"name":"паприка","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Говядина тушёная с луком', 235.0, 24.5, 14.0, 5.0, 'main', 200, 95.0, false,
 '[{"name":"говядина","category":"meat","qty":170,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":80,"unit":"г"},{"name":"морковь","category":"vegetable","qty":60,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"лавровый лист","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Свинина с картошкой в духовке', 285.0, 18.5, 16.5, 17.0, 'main', 250, 75.0, true,
 '[{"name":"свинина","category":"meat","qty":150,"unit":"г"},{"name":"картофель","category":"vegetable","qty":200,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"}]'),

('Пельмени со сметаной', 265.0, 11.5, 11.0, 29.5, 'main', 300, 65.0, true,
 '[{"name":"пельмени","category":"meat","qty":280,"unit":"г"},{"name":"сметана","category":"dairy","qty":40,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Рыба жареная', 175.0, 19.5, 9.5, 4.5, 'main', 200, 70.0, false,
 '[{"name":"минтай","category":"meat","qty":220,"unit":"г"},{"name":"мука пшеничная","category":"grain","qty":20,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":20,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"лимон","category":"fruit","qty":0.5,"unit":"шт"}]'),

('Куриные бёдра тушёные', 215.0, 20.5, 13.5, 3.0, 'main', 220, 55.0, false,
 '[{"name":"куриные бёдра","category":"meat","qty":250,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":60,"unit":"г"},{"name":"морковь","category":"vegetable","qty":50,"unit":"г"},{"name":"томатная паста","category":"condiment","qty":20,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Макароны по-флотски', 240.0, 16.5, 10.5, 22.0, 'main', 250, 45.0, true,
 '[{"name":"макароны","category":"grain","qty":100,"unit":"г"},{"name":"фарш говяжий","category":"meat","qty":120,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":60,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"томатная паста","category":"condiment","qty":20,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Лосось запечённый с лимоном', 208.0, 20.0, 13.5, 0.5, 'main', 200, 160.0, false,
 '[{"name":"лосось","category":"meat","qty":220,"unit":"г"},{"name":"лимон","category":"fruit","qty":0.5,"unit":"шт"},{"name":"масло оливковое","category":"condiment","qty":15,"unit":"мл"},{"name":"укроп","category":"vegetable","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"перец","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Тефтели в томатном соусе', 175.0, 12.5, 9.5, 10.5, 'main', 250, 50.0, false,
 '[{"name":"фарш смешанный","category":"meat","qty":150,"unit":"г"},{"name":"рис","category":"grain","qty":30,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"томатная паста","category":"condiment","qty":40,"unit":"г"},{"name":"морковь","category":"vegetable","qty":50,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

-- ── Гарниры ──────────────────────────────────────────────────────────
('Гречка варёная', 110.0, 4.2, 1.1, 21.3, 'side', 200, 12.0, false,
 '[{"name":"гречка","category":"grain","qty":80,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Рис белый варёный', 130.0, 2.7, 0.3, 28.0, 'side', 200, 10.0, false,
 '[{"name":"рис белый","category":"grain","qty":80,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Картофельное пюре', 115.0, 2.5, 4.5, 16.5, 'side', 200, 18.0, false,
 '[{"name":"картофель","category":"vegetable","qty":250,"unit":"г"},{"name":"молоко","category":"dairy","qty":80,"unit":"мл"},{"name":"масло сливочное","category":"condiment","qty":15,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Макароны варёные', 138.0, 4.7, 0.7, 27.5, 'side', 200, 15.0, false,
 '[{"name":"макароны","category":"grain","qty":80,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Капуста тушёная', 75.0, 2.5, 4.5, 7.0, 'side', 200, 20.0, false,
 '[{"name":"капуста белокочанная","category":"vegetable","qty":300,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"морковь","category":"vegetable","qty":50,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":20,"unit":"мл"},{"name":"томатная паста","category":"condiment","qty":20,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Перловая каша', 109.0, 3.1, 0.4, 22.2, 'side', 200, 8.0, false,
 '[{"name":"перловая крупа","category":"grain","qty":70,"unit":"г"},{"name":"масло сливочное","category":"condiment","qty":10,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Брокколи на пару', 35.0, 2.8, 0.4, 4.3, 'side', 200, 35.0, false,
 '[{"name":"брокколи","category":"vegetable","qty":220,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"},{"name":"масло оливковое","category":"condiment","qty":10,"unit":"мл"}]'),

('Тушёные кабачки', 55.0, 1.5, 2.5, 6.5, 'side', 200, 15.0, false,
 '[{"name":"кабачки","category":"vegetable","qty":250,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"морковь","category":"vegetable","qty":40,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Чечевица варёная', 116.0, 7.8, 0.6, 20.0, 'side', 200, 18.0, false,
 '[{"name":"чечевица","category":"grain","qty":80,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":50,"unit":"г"},{"name":"морковь","category":"vegetable","qty":40,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Картофель запечённый', 105.0, 2.8, 2.5, 18.5, 'side', 200, 12.0, false,
 '[{"name":"картофель","category":"vegetable","qty":250,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"розмарин","category":"condiment","qty":1,"unit":"щепотка"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

-- ── Салаты ───────────────────────────────────────────────────────────
('Салат из огурцов и помидоров', 42.0, 1.2, 2.5, 3.8, 'salad', 180, 30.0, false,
 '[{"name":"огурцы","category":"vegetable","qty":80,"unit":"г"},{"name":"помидоры","category":"vegetable","qty":80,"unit":"г"},{"name":"лук зелёный","category":"vegetable","qty":15,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":10,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Салат греческий', 115.0, 3.5, 9.5, 5.0, 'salad', 200, 65.0, false,
 '[{"name":"помидоры","category":"vegetable","qty":70,"unit":"г"},{"name":"огурцы","category":"vegetable","qty":50,"unit":"г"},{"name":"перец болгарский","category":"vegetable","qty":40,"unit":"г"},{"name":"лук красный","category":"vegetable","qty":20,"unit":"г"},{"name":"сыр фета","category":"dairy","qty":50,"unit":"г"},{"name":"маслины","category":"condiment","qty":20,"unit":"г"},{"name":"масло оливковое","category":"condiment","qty":15,"unit":"мл"},{"name":"орегано","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Салат Оливье', 198.0, 7.5, 14.5, 11.0, 'salad', 200, 45.0, false,
 '[{"name":"картофель","category":"vegetable","qty":50,"unit":"г"},{"name":"морковь","category":"vegetable","qty":30,"unit":"г"},{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"колбаса варёная","category":"meat","qty":50,"unit":"г"},{"name":"огурцы маринованные","category":"vegetable","qty":30,"unit":"г"},{"name":"горошек зелёный","category":"vegetable","qty":30,"unit":"г"},{"name":"майонез","category":"condiment","qty":40,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Морковный салат с чесноком', 85.0, 1.5, 5.5, 7.5, 'salad', 150, 15.0, false,
 '[{"name":"морковь","category":"vegetable","qty":120,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":10,"unit":"г"},{"name":"майонез","category":"condiment","qty":30,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Винегрет', 75.0, 1.7, 3.5, 9.0, 'salad', 200, 20.0, false,
 '[{"name":"свёкла","category":"vegetable","qty":60,"unit":"г"},{"name":"картофель","category":"vegetable","qty":50,"unit":"г"},{"name":"морковь","category":"vegetable","qty":40,"unit":"г"},{"name":"огурцы маринованные","category":"vegetable","qty":30,"unit":"г"},{"name":"лук репчатый","category":"vegetable","qty":20,"unit":"г"},{"name":"горошек зелёный","category":"vegetable","qty":20,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Салат из капусты', 48.0, 1.5, 2.0, 6.5, 'salad', 180, 12.0, false,
 '[{"name":"капуста белокочанная","category":"vegetable","qty":140,"unit":"г"},{"name":"морковь","category":"vegetable","qty":40,"unit":"г"},{"name":"масло растительное","category":"condiment","qty":15,"unit":"мл"},{"name":"уксус","category":"condiment","qty":10,"unit":"мл"},{"name":"сахар","category":"condiment","qty":5,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Салат Цезарь с курицей', 185.0, 16.5, 11.5, 6.5, 'salad', 200, 80.0, false,
 '[{"name":"куриное филе","category":"meat","qty":80,"unit":"г"},{"name":"салат романо","category":"vegetable","qty":60,"unit":"г"},{"name":"сыр пармезан","category":"dairy","qty":20,"unit":"г"},{"name":"сухарики","category":"grain","qty":20,"unit":"г"},{"name":"соус цезарь","category":"condiment","qty":30,"unit":"г"}]'),

('Свекольный салат с орехами', 145.0, 3.5, 8.5, 14.5, 'salad', 150, 35.0, false,
 '[{"name":"свёкла","category":"vegetable","qty":100,"unit":"г"},{"name":"чеснок","category":"vegetable","qty":5,"unit":"г"},{"name":"грецкие орехи","category":"other","qty":20,"unit":"г"},{"name":"майонез","category":"condiment","qty":25,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Салат из тунца', 135.0, 14.5, 7.0, 4.0, 'salad', 180, 75.0, false,
 '[{"name":"тунец консервированный","category":"meat","qty":80,"unit":"г"},{"name":"помидоры","category":"vegetable","qty":50,"unit":"г"},{"name":"огурцы","category":"vegetable","qty":30,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"лук зелёный","category":"vegetable","qty":10,"unit":"г"},{"name":"майонез","category":"condiment","qty":30,"unit":"г"}]'),

('Дачный салат', 55.0, 1.8, 3.0, 5.5, 'salad', 180, 25.0, false,
 '[{"name":"огурцы","category":"vegetable","qty":60,"unit":"г"},{"name":"помидоры","category":"vegetable","qty":60,"unit":"г"},{"name":"болгарский перец","category":"vegetable","qty":40,"unit":"г"},{"name":"зелень","category":"vegetable","qty":10,"unit":"г"},{"name":"сметана","category":"dairy","qty":25,"unit":"г"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

-- ── Перекусы ─────────────────────────────────────────────────────────
('Творог с фруктами', 130.0, 14.5, 3.5, 11.0, 'snack', 200, 40.0, false,
 '[{"name":"творог","category":"dairy","qty":150,"unit":"г"},{"name":"яблоко","category":"fruit","qty":0.5,"unit":"шт"},{"name":"банан","category":"fruit","qty":0.5,"unit":"шт"},{"name":"мёд","category":"condiment","qty":15,"unit":"г"}]'),

('Йогурт с мюсли', 185.0, 7.5, 4.5, 30.0, 'snack', 200, 40.0, false,
 '[{"name":"йогурт натуральный","category":"dairy","qty":150,"unit":"мл"},{"name":"мюсли","category":"grain","qty":50,"unit":"г"},{"name":"ягоды","category":"fruit","qty":30,"unit":"г"}]'),

('Яблоко с арахисовой пастой', 185.0, 5.5, 9.5, 22.0, 'snack', 150, 45.0, false,
 '[{"name":"яблоко","category":"fruit","qty":1,"unit":"шт"},{"name":"арахисовая паста","category":"other","qty":30,"unit":"г"}]'),

('Кефир с хлебцами', 95.0, 5.5, 2.0, 13.5, 'snack', 250, 25.0, false,
 '[{"name":"кефир","category":"dairy","qty":200,"unit":"мл"},{"name":"хлебцы","category":"grain","qty":40,"unit":"г"}]'),

('Банан с орехами', 210.0, 4.5, 9.5, 28.5, 'snack', 150, 50.0, false,
 '[{"name":"банан","category":"fruit","qty":1,"unit":"шт"},{"name":"грецкие орехи","category":"other","qty":25,"unit":"г"}]'),

('Творожная запеканка', 175.0, 13.0, 7.5, 14.5, 'snack', 150, 40.0, false,
 '[{"name":"творог","category":"dairy","qty":100,"unit":"г"},{"name":"яйца","category":"dairy","qty":1,"unit":"шт"},{"name":"манная крупа","category":"grain","qty":20,"unit":"г"},{"name":"сахар","category":"condiment","qty":15,"unit":"г"},{"name":"сметана","category":"dairy","qty":20,"unit":"г"},{"name":"изюм","category":"fruit","qty":20,"unit":"г"}]'),

('Бутерброд с авокадо', 220.0, 4.5, 12.5, 23.5, 'snack', 120, 60.0, false,
 '[{"name":"хлеб цельнозерновой","category":"grain","qty":60,"unit":"г"},{"name":"авокадо","category":"fruit","qty":0.5,"unit":"шт"},{"name":"лимонный сок","category":"condiment","qty":5,"unit":"мл"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Варёное яйцо', 155.0, 12.9, 11.5, 0.7, 'snack', 100, 15.0, false,
 '[{"name":"яйца","category":"dairy","qty":2,"unit":"шт"},{"name":"соль","category":"condiment","qty":1,"unit":"щепотка"}]'),

('Фруктовый салат', 75.0, 1.0, 0.5, 17.0, 'snack', 200, 45.0, false,
 '[{"name":"яблоко","category":"fruit","qty":0.5,"unit":"шт"},{"name":"банан","category":"fruit","qty":0.5,"unit":"шт"},{"name":"апельсин","category":"fruit","qty":0.5,"unit":"шт"},{"name":"клубника","category":"fruit","qty":50,"unit":"г"},{"name":"мёд","category":"condiment","qty":10,"unit":"г"}]'),

('Сыр с виноградом', 215.0, 9.5, 15.0, 11.5, 'snack', 100, 65.0, false,
 '[{"name":"сыр твёрдый","category":"dairy","qty":60,"unit":"г"},{"name":"виноград","category":"fruit","qty":50,"unit":"г"}]');
