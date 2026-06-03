/**
 * Экспорт food_catalog в Excel-файл.
 *
 * Запуск:
 *   node scripts/export-food-catalog.mjs
 *
 * Что делает:
 *   1. Подключается к Supabase, читает всю таблицу food_catalog
 *   2. Создаёт food-catalog.xlsx в корне проекта с тремя листами:
 *      - Блюда: основные поля + КБЖУ + цена
 *      - Ингредиенты: dish_id → ингредиенты с qty/unit
 *      - Инструкция: как работать с файлом
 *   3. Включает freeze panes, ширину колонок, dropdown-валидацию категорий
 *
 * Требования: PUBLIC_SUPABASE_URL и PUBLIC_SUPABASE_ANON_KEY в .env
 */

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OUTPUT_FILE = join(PROJECT_ROOT, 'food-catalog.xlsx');

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('❌ Не найдены PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY в .env');
	process.exit(1);
}

const DISH_CATEGORIES = ['breakfast', 'main', 'side', 'salad', 'snack'];
const ING_CATEGORIES  = ['meat', 'dairy', 'grain', 'vegetable', 'fruit', 'condiment', 'other'];
const UNITS           = ['г', 'мл', 'шт', 'щепотка'];

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };

async function main() {
	console.log('📡 Подключаюсь к Supabase…');
	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

	console.log('📥 Загружаю food_catalog…');
	const { data: dishes, error } = await supabase
		.from('food_catalog')
		.select('*')
		.order('category', { ascending: true })
		.order('id', { ascending: true });

	if (error) {
		console.error('❌ Ошибка загрузки:', error.message);
		process.exit(1);
	}
	if (!dishes || dishes.length === 0) {
		console.error('\n❌ Загружено 0 блюд. Возможные причины:');
		console.error('   1. На food_catalog включён RLS, который блокирует anon-ключ.');
		console.error('   2. Таблица реально пуста.');
		console.error('\n   Решение: добавьте в .env строку:');
		console.error('   SUPABASE_SERVICE_ROLE_KEY=...');
		console.error('   (взять в Supabase Dashboard → Settings → API → service_role secret)');
		process.exit(1);
	}
	console.log(`✅ Загружено блюд: ${dishes.length}`);

	const wb = new ExcelJS.Workbook();
	wb.creator = 'MealPlaniX';
	wb.created = new Date();

	// ═══ Лист 1: Блюда ════════════════════════════════════════════════
	const dishSheet = wb.addWorksheet('Блюда', {
		views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
	});

	dishSheet.columns = [
		{ header: 'id',            key: 'id',                width: 6  },
		{ header: 'Название',      key: 'name',              width: 38 },
		{ header: 'Категория',     key: 'category',          width: 12 },
		{ header: 'Ккал / 100г',   key: 'kcal_per_100g',     width: 12 },
		{ header: 'Белки / 100г',  key: 'protein_per_100g',  width: 12 },
		{ header: 'Жиры / 100г',   key: 'fat_per_100g',      width: 12 },
		{ header: 'Углеводы /100г',key: 'carbs_per_100g',    width: 14 },
		{ header: 'Порция, г',     key: 'portion_default_g', width: 11 },
		{ header: 'Цена ₽ /100г',  key: 'cost_per_100g',     width: 12 },
		{ header: 'Самодостаточно',key: 'standalone',        width: 14 },
		{ header: 'Фото URL',      key: 'photo',             width: 30 },
		{ header: 'Заметка',       key: '_note',             width: 28 }
	];

	// Заголовок
	const dishHeader = dishSheet.getRow(1);
	dishHeader.height = 24;
	dishHeader.eachCell((cell) => {
		cell.fill = HEADER_FILL;
		cell.font = HEADER_FONT;
		cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
		cell.border = { bottom: { style: 'medium', color: { argb: 'FF065F46' } } };
	});

	// Строки
	for (const d of dishes) {
		dishSheet.addRow({
			id:                d.id,
			name:              d.name,
			category:          d.category,
			kcal_per_100g:     toNum(d.kcal_per_100g),
			protein_per_100g:  toNum(d.protein_per_100g),
			fat_per_100g:      toNum(d.fat_per_100g),
			carbs_per_100g:    toNum(d.carbs_per_100g),
			portion_default_g: toNum(d.portion_default_g),
			cost_per_100g:     toNum(d.cost_per_100g),
			standalone:        d.standalone ? 'да' : 'нет',
			photo:             d.photo ?? '',
			_note:             ''
		});
	}

	// Валидация: dropdown для category и standalone. Резервируем строки до 500.
	const maxRow = Math.max(dishes.length + 1, 500);
	dishSheet.dataValidations.add(`C2:C${maxRow}`, {
		type: 'list',
		allowBlank: false,
		formulae: [`"${DISH_CATEGORIES.join(',')}"`],
		showErrorMessage: true,
		errorTitle: 'Неверная категория',
		error: `Допустимо: ${DISH_CATEGORIES.join(', ')}`
	});
	dishSheet.dataValidations.add(`J2:J${maxRow}`, {
		type: 'list',
		allowBlank: false,
		formulae: ['"да,нет"'],
		showErrorMessage: true
	});

	// Стили данных
	const idCol = dishSheet.getColumn('id');
	idCol.alignment = { horizontal: 'center' };
	idCol.font = { color: { argb: 'FF6B7280' }, italic: true };

	dishSheet.getColumn('kcal_per_100g').numFmt    = '0.0';
	dishSheet.getColumn('protein_per_100g').numFmt = '0.0';
	dishSheet.getColumn('fat_per_100g').numFmt     = '0.0';
	dishSheet.getColumn('carbs_per_100g').numFmt   = '0.0';
	dishSheet.getColumn('cost_per_100g').numFmt    = '0.00';

	// Условное форматирование: подсветка пустых названий
	dishSheet.addConditionalFormatting({
		ref: `B2:B${dishes.length + 1}`,
		rules: [
			{
				type: 'expression',
				formulae: ['LEN(TRIM(B2))=0'],
				style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEB' } } }
			}
		]
	});

	// ═══ Лист 2: Ингредиенты ══════════════════════════════════════════
	const ingSheet = wb.addWorksheet('Ингредиенты', {
		views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }]
	});

	ingSheet.columns = [
		{ header: 'dish_id',    key: 'dish_id',    width: 8  },
		{ header: 'Блюдо',      key: 'dish_name',  width: 38 },
		{ header: 'Ингредиент', key: 'name',       width: 28 },
		{ header: 'Категория',  key: 'category',   width: 12 },
		{ header: 'Кол-во',     key: 'qty',        width: 10 },
		{ header: 'Ед.',        key: 'unit',       width: 10 }
	];

	const ingHeader = ingSheet.getRow(1);
	ingHeader.height = 24;
	ingHeader.eachCell((cell) => {
		cell.fill = HEADER_FILL;
		cell.font = HEADER_FONT;
		cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
		cell.border = { bottom: { style: 'medium', color: { argb: 'FF065F46' } } };
	});

	let totalIng = 0;
	for (const d of dishes) {
		const ingredients = Array.isArray(d.ingredients) ? d.ingredients : [];
		for (const ing of ingredients) {
			ingSheet.addRow({
				dish_id:   d.id,
				dish_name: d.name,
				name:      ing.name ?? '',
				category:  ing.category ?? 'other',
				qty:       ing.qty ?? null,
				unit:      ing.unit ?? ''
			});
			totalIng++;
		}
	}

	// Валидации в ингредиентах. Резервируем до 3000 строк.
	const maxIngRow = Math.max(totalIng + 1, 3000);
	ingSheet.dataValidations.add(`D2:D${maxIngRow}`, {
		type: 'list',
		allowBlank: false,
		formulae: [`"${ING_CATEGORIES.join(',')}"`],
		showErrorMessage: true,
		errorTitle: 'Неверная категория ингредиента',
		error: `Допустимо: ${ING_CATEGORIES.join(', ')}`
	});
	ingSheet.dataValidations.add(`F2:F${maxIngRow}`, {
		type: 'list',
		allowBlank: false,
		formulae: [`"${UNITS.join(',')}"`],
		showErrorMessage: true
	});

	// Стиль: dish_id — серый, dish_name — приглушённый (служебные колонки)
	ingSheet.getColumn('dish_id').font = { color: { argb: 'FF6B7280' }, italic: true };
	ingSheet.getColumn('dish_id').alignment = { horizontal: 'center' };
	ingSheet.getColumn('dish_name').font = { color: { argb: 'FF6B7280' }, italic: true };

	// Чередование строк по dish_id для удобства
	let prevId = null;
	let stripe = false;
	for (let rowNum = 2; rowNum <= totalIng + 1; rowNum++) {
		const id = ingSheet.getCell(`A${rowNum}`).value;
		if (id !== prevId) {
			stripe = !stripe;
			prevId = id;
		}
		if (stripe) {
			for (let col = 1; col <= 6; col++) {
				ingSheet.getCell(rowNum, col).fill = {
					type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' }
				};
			}
		}
	}

	// ═══ Лист 3: Инструкция ═══════════════════════════════════════════
	const infoSheet = wb.addWorksheet('Инструкция');
	infoSheet.columns = [{ width: 100 }];

	const instructions = [
		['📘 КАК РАБОТАТЬ С ФАЙЛОМ', true],
		['', false],
		['Файл содержит два листа с данными: «Блюда» и «Ингредиенты».', false],
		['', false],
		['─── ЛИСТ «БЛЮДА» ────────────────────────────────────────────────', false],
		['• id — служебный, НЕ ИЗМЕНЯТЬ. Для новых блюд оставьте пустым.', false],
		['• Название — название блюда (обязательно).', false],
		['• Категория — выберите из выпадающего списка: breakfast/main/side/salad/snack.', false],
		['• КБЖУ — на 100 граммов готового блюда (не на порцию!).', false],
		['• Порция — размер стандартной порции в граммах.', false],
		['• Цена — рублей за 100 граммов.', false],
		['• Самодостаточно — «да» если есть и белок и углевод (свинина+картошка), иначе «нет».', false],
		['• Фото URL — путь к фото (например, /photodishes/file.png).', false],
		['• Заметка — любые комментарии для вас (не загружается в базу).', false],
		['', false],
		['─── ЛИСТ «ИНГРЕДИЕНТЫ» ─────────────────────────────────────────', false],
		['• dish_id — связывает ингредиент с блюдом. НЕ ИЗМЕНЯТЬ.', false],
		['• Блюдо — название блюда (для удобства, не редактируется).', false],
		['• Ингредиент — название продукта.', false],
		['• Категория — для группировки в корзине покупок (выпадающий список).', false],
		['• Кол-во — количество на ОДНУ порцию (равную полю «Порция» в листе «Блюда»).', false],
		['• Ед. — г / мл / шт / щепотка.', false],
		['', false],
		['─── ДОБАВЛЕНИЕ НОВОГО БЛЮДА ───────────────────────────────────', false],
		['1. На листе «Блюда» добавьте новую строку, оставив id ПУСТЫМ.', false],
		['2. Заполните все обязательные поля (название, категория, КБЖУ, порция, цена).', false],
		['3. На листе «Ингредиенты» добавьте ингредиенты — в колонку dish_id впишите ID,', false],
		['   который будет присвоен после импорта (например, «NEW-1», «NEW-2»).', false],
		['4. Скрипт импорта присвоит реальные id и свяжет ингредиенты автоматически.', false],
		['', false],
		['─── УДАЛЕНИЕ БЛЮДА ────────────────────────────────────────────', false],
		['• Просто удалите строку из листа «Блюда».', false],
		['• Ингредиенты этого блюда удалятся автоматически при импорте.', false],
		['• ВАЖНО: если блюдо есть в существующих меню (menu_plans), импорт его НЕ удалит', false],
		['  чтобы не сломать историю. Появится предупреждение.', false],
		['', false],
		['─── ОБРАТНЫЙ ИМПОРТ ──────────────────────────────────────────', false],
		['Команда:  node scripts/import-food-catalog.mjs', false],
		['Перед импортом сделайте резервный SQL-dump в Supabase.', false],
		['Импорт показывает план изменений и спрашивает подтверждение.', false]
	];

	let row = 1;
	for (const [text, isHeader] of instructions) {
		const cell = infoSheet.getCell(row, 1);
		cell.value = text;
		if (isHeader) {
			cell.font = { bold: true, size: 14, color: { argb: 'FF065F46' } };
			infoSheet.getRow(row).height = 24;
		} else if (text.startsWith('───')) {
			cell.font = { bold: true, size: 11, color: { argb: 'FF065F46' } };
		} else {
			cell.font = { size: 11, color: { argb: 'FF1F2937' } };
		}
		cell.alignment = { wrapText: true, vertical: 'middle' };
		row++;
	}

	// ═══ Сохранение ═══════════════════════════════════════════════════
	await wb.xlsx.writeFile(OUTPUT_FILE);
	console.log(`\n✅ Файл создан: ${OUTPUT_FILE}`);
	console.log(`   • Блюд: ${dishes.length}`);
	console.log(`   • Ингредиентов: ${totalIng}`);
	console.log(`\nОткройте файл в Excel или LibreOffice Calc.`);
	console.log(`Для обратного импорта: node scripts/import-food-catalog.mjs`);
}

function toNum(v) {
	if (v == null) return null;
	const n = typeof v === 'string' ? parseFloat(v) : v;
	return Number.isFinite(n) ? n : null;
}

main().catch((e) => {
	console.error('❌ Сбой:', e);
	process.exit(1);
});
