/**
 * Импорт food_catalog из Excel-файла обратно в Supabase.
 *
 * Запуск:
 *   node scripts/import-food-catalog.mjs              — план изменений + подтверждение
 *   node scripts/import-food-catalog.mjs --apply      — применить без подтверждения
 *   node scripts/import-food-catalog.mjs --keep-orphans — не удалять блюда отсутствующие в файле
 *
 * Что делает:
 *   1. Читает food-catalog.xlsx из корня проекта
 *   2. Парсит листы «Блюда» и «Ингредиенты»
 *   3. Сравнивает с текущей food_catalog в Supabase
 *   4. Показывает план изменений: INSERT / UPDATE / DELETE
 *   5. При подтверждении применяет изменения
 *
 * Требования: SUPABASE_SERVICE_ROLE_KEY в .env (для INSERT/UPDATE/DELETE)
 *             либо PUBLIC_SUPABASE_ANON_KEY если RLS разрешает запись
 */

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY;

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((a) => a.startsWith('--')));
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const APPLY_NO_CONFIRM = flags.has('--apply');
const KEEP_ORPHANS     = flags.has('--keep-orphans');
const INPUT_FILE = positional[0]
	? (positional[0].match(/^[A-Za-z]:|^\//) ? positional[0] : join(PROJECT_ROOT, positional[0]))
	: join(PROJECT_ROOT, 'food-catalog.xlsx');

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('❌ Не найдены PUBLIC_SUPABASE_URL / SUPABASE ключ в .env');
	process.exit(1);
}

if (!existsSync(INPUT_FILE)) {
	console.error(`❌ Файл не найден: ${INPUT_FILE}`);
	console.error('   Сначала выполните: node scripts/export-food-catalog.mjs');
	process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
	console.warn('⚠️  Используется ANON-ключ. Если есть RLS на food_catalog, запись провалится.');
	console.warn('    Для надёжности добавьте SUPABASE_SERVICE_ROLE_KEY в .env\n');
}

const DISH_CATEGORIES = ['breakfast', 'main', 'side', 'salad', 'snack'];
const ING_CATEGORIES  = ['meat', 'dairy', 'grain', 'vegetable', 'fruit', 'condiment', 'other'];

async function main() {
	console.log(`📂 Читаю ${INPUT_FILE}…`);
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(INPUT_FILE);

	const dishSheet = wb.getWorksheet('Блюда');
	const ingSheet  = wb.getWorksheet('Ингредиенты');
	if (!dishSheet || !ingSheet) {
		console.error('❌ В файле должны быть листы «Блюда» и «Ингредиенты»');
		process.exit(1);
	}

	// ── Парсим блюда ────────────────────────────────────────────
	const dishesFromFile = [];
	const errors = [];
	dishSheet.eachRow((row, num) => {
		if (num === 1) return; // заголовок
		const id        = cellNum(row.getCell(1));
		const name      = cellStr(row.getCell(2));
		const category  = cellStr(row.getCell(3));
		const kcal      = cellNum(row.getCell(4));
		const protein   = cellNum(row.getCell(5));
		const fat       = cellNum(row.getCell(6));
		const carbs     = cellNum(row.getCell(7));
		const portion   = cellNum(row.getCell(8));
		const cost      = cellNum(row.getCell(9));
		const standaloneStr = cellStr(row.getCell(10)).toLowerCase();
		const photo     = cellStr(row.getCell(11));

		if (!name) return; // пропускаем пустые строки

		const errs = [];
		if (!DISH_CATEGORIES.includes(category))
			errs.push(`категория «${category}» не в списке ${DISH_CATEGORIES.join('/')}`);
		if (kcal == null)    errs.push('пустые ккал');
		if (protein == null) errs.push('пустые белки');
		if (fat == null)     errs.push('пустые жиры');
		if (carbs == null)   errs.push('пустые углеводы');
		if (!portion)        errs.push('пустая порция');
		if (cost == null)    errs.push('пустая цена');
		if (errs.length) {
			errors.push(`Строка ${num} («${name}»): ${errs.join(', ')}`);
			return;
		}

		dishesFromFile.push({
			fileRowNum: num,
			id, // null для новых
			data: {
				name,
				category,
				kcal_per_100g:     kcal,
				protein_per_100g:  protein,
				fat_per_100g:      fat,
				carbs_per_100g:    carbs,
				portion_default_g: Math.round(portion),
				cost_per_100g:     cost,
				standalone:        standaloneStr === 'да' || standaloneStr === 'true' || standaloneStr === 'yes',
				photo:             photo || null
			},
			ingredients: []
		});
	});

	if (errors.length) {
		console.error('❌ Ошибки в листе «Блюда»:');
		for (const e of errors) console.error('  •', e);
		process.exit(1);
	}

	// ── Парсим ингредиенты и привязываем к блюдам ───────────────
	const ingErrors = [];
	const orphans = new Map(); // dish_id → кол-во осиротевших строк
	const byId = new Map(dishesFromFile.filter((d) => d.id != null).map((d) => [d.id, d]));
	const newRowKey = (key) => `NEW:${key}`;
	const byNewKey = new Map();

	ingSheet.eachRow((row, num) => {
		if (num === 1) return;
		const dishIdRaw = row.getCell(1).value;
		const name      = cellStr(row.getCell(3));
		const category  = cellStr(row.getCell(4));
		const qty       = cellNum(row.getCell(5));
		const unit      = cellStr(row.getCell(6));

		if (!name) return;

		const errs = [];
		if (!ING_CATEGORIES.includes(category))
			errs.push(`категория «${category}» не в списке ${ING_CATEGORIES.join('/')}`);
		if (!unit) errs.push('пустая единица измерения');
		if (errs.length) {
			ingErrors.push(`Ингр. строка ${num} («${name}»): ${errs.join(', ')}`);
			return;
		}

		const ing = { name, category, qty: qty ?? null, unit };

		const idNum = typeof dishIdRaw === 'number' ? dishIdRaw : parseFloat(dishIdRaw);
		if (Number.isFinite(idNum)) {
			const dish = byId.get(idNum);
			if (!dish) {
				// Блюдо удалили на листе «Блюда» — игнорируем оставшиеся ингредиенты
				orphans.set(idNum, (orphans.get(idNum) ?? 0) + 1);
				return;
			}
			dish.ingredients.push(ing);
		} else {
			// Это новое блюдо — связываем по ключу из ячейки (например, NEW-1)
			const key = newRowKey(String(dishIdRaw ?? '').trim() || `row${num}`);
			if (!byNewKey.has(key)) byNewKey.set(key, []);
			byNewKey.get(key).push(ing);
		}
	});

	if (orphans.size > 0) {
		console.log(`⚠️  Найдены осиротевшие ингредиенты (без блюда) — пропускаются:`);
		const orphanList = Array.from(orphans.entries()).slice(0, 10);
		for (const [id, cnt] of orphanList) console.log(`   • dish_id=${id}: ${cnt} ингр.`);
		if (orphans.size > 10) console.log(`   …и ещё ${orphans.size - 10} блюд`);
		console.log('');
	}

	// Привязываем "новые" ингредиенты к новым блюдам по порядку
	const newDishes = dishesFromFile.filter((d) => d.id == null);
	const newKeysOrdered = Array.from(byNewKey.keys());
	if (newKeysOrdered.length > 0 && newKeysOrdered.length !== newDishes.length) {
		console.warn(`⚠️  Новых блюд: ${newDishes.length}, групп ингредиентов с не-числовым dish_id: ${newKeysOrdered.length}`);
	}
	for (let i = 0; i < newDishes.length; i++) {
		const key = newKeysOrdered[i];
		if (key && byNewKey.has(key)) {
			newDishes[i].ingredients = byNewKey.get(key);
		}
	}

	if (ingErrors.length) {
		console.error('❌ Ошибки в листе «Ингредиенты»:');
		for (const e of ingErrors) console.error('  •', e);
		process.exit(1);
	}

	// ── Сравниваем с тем что в БД ────────────────────────────────
	console.log('📡 Подключаюсь к Supabase…');
	const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
	const { data: dbDishes, error } = await supabase.from('food_catalog').select('*');
	if (error) {
		console.error('❌ Ошибка загрузки из БД:', error.message);
		process.exit(1);
	}
	const dbById = new Map(dbDishes.map((d) => [d.id, d]));
	const fileIds = new Set(dishesFromFile.filter((d) => d.id != null).map((d) => d.id));

	const toInsert = dishesFromFile.filter((d) => d.id == null);
	const toUpdate = [];
	const toDelete = [];

	for (const d of dishesFromFile) {
		if (d.id == null) continue;
		const dbRow = dbById.get(d.id);
		if (!dbRow) {
			console.warn(`⚠️  Блюдо id=${d.id} (${d.data.name}) есть в файле, но не в БД — будет создано`);
			toInsert.push(d);
			continue;
		}
		if (hasChanges(dbRow, d)) toUpdate.push(d);
	}

	for (const dbRow of dbDishes) {
		if (!fileIds.has(dbRow.id)) toDelete.push(dbRow);
	}

	// ── План изменений ──────────────────────────────────────────
	console.log('\n═══ ПЛАН ИЗМЕНЕНИЙ ═══');
	console.log(`  ➕ Создать:    ${toInsert.length}`);
	console.log(`  ✏️  Обновить:   ${toUpdate.length}`);
	console.log(`  ${KEEP_ORPHANS ? '⏭️ ' : '🗑️ '} Удалить:    ${toDelete.length}${KEEP_ORPHANS ? ' (пропущены)' : ''}`);

	if (toInsert.length) {
		console.log('\n➕ Будут созданы:');
		for (const d of toInsert.slice(0, 10)) console.log(`   • ${d.data.name} (${d.data.category})`);
		if (toInsert.length > 10) console.log(`   …и ещё ${toInsert.length - 10}`);
	}
	if (toUpdate.length) {
		console.log('\n✏️  Будут обновлены:');
		for (const d of toUpdate.slice(0, 10)) console.log(`   • id=${d.id} ${d.data.name}`);
		if (toUpdate.length > 10) console.log(`   …и ещё ${toUpdate.length - 10}`);
	}
	if (toDelete.length && !KEEP_ORPHANS) {
		console.log('\n🗑️  Будут удалены:');
		for (const d of toDelete.slice(0, 10)) console.log(`   • id=${d.id} ${d.name}`);
		if (toDelete.length > 10) console.log(`   …и ещё ${toDelete.length - 10}`);
	}

	if (toInsert.length === 0 && toUpdate.length === 0 && (toDelete.length === 0 || KEEP_ORPHANS)) {
		console.log('\n✅ Нечего применять — данные совпадают.');
		return;
	}

	if (!APPLY_NO_CONFIRM) {
		const ok = await confirm('\nПрименить изменения? (yes/no): ');
		if (!ok) {
			console.log('Отменено.');
			return;
		}
	}

	// ── Применение ──────────────────────────────────────────────
	console.log('\n🚀 Применяю изменения…');

	for (const d of toUpdate) {
		const payload = { ...d.data, ingredients: d.ingredients };
		const { error } = await supabase.from('food_catalog').update(payload).eq('id', d.id);
		if (error) console.error(`   ❌ UPDATE id=${d.id} ${d.data.name}: ${error.message}`);
		else      console.log(`   ✏️  обновлено: ${d.data.name}`);
	}

	for (const d of toInsert) {
		const payload = { ...d.data, ingredients: d.ingredients };
		const { error, data: created } = await supabase.from('food_catalog').insert(payload).select('id').single();
		if (error) console.error(`   ❌ INSERT ${d.data.name}: ${error.message}`);
		else      console.log(`   ➕ создано: ${d.data.name} (новый id=${created?.id})`);
	}

	if (!KEEP_ORPHANS) {
		for (const d of toDelete) {
			const { error } = await supabase.from('food_catalog').delete().eq('id', d.id);
			if (error) console.error(`   ❌ DELETE id=${d.id} ${d.name}: ${error.message}`);
			else      console.log(`   🗑️  удалено: ${d.name}`);
		}
	}

	console.log('\n✅ Готово.');
}

function cellStr(cell) {
	if (cell.value == null) return '';
	if (typeof cell.value === 'object' && 'text' in cell.value) return String(cell.value.text).trim();
	return String(cell.value).trim();
}

function cellNum(cell) {
	if (cell.value == null || cell.value === '') return null;
	if (typeof cell.value === 'number') return cell.value;
	const s = String(cell.value).replace(',', '.').trim();
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : null;
}

function hasChanges(dbRow, fileEntry, debug = false) {
	const f = fileEntry.data;
	const diffs = [];
	if (dbRow.name !== f.name) diffs.push(['name', dbRow.name, f.name]);
	if (dbRow.category !== f.category) diffs.push(['category', dbRow.category, f.category]);
	if (!eqNum(dbRow.kcal_per_100g, f.kcal_per_100g))
		diffs.push(['kcal_per_100g', dbRow.kcal_per_100g, f.kcal_per_100g]);
	if (!eqNum(dbRow.protein_per_100g, f.protein_per_100g))
		diffs.push(['protein_per_100g', dbRow.protein_per_100g, f.protein_per_100g]);
	if (!eqNum(dbRow.fat_per_100g, f.fat_per_100g))
		diffs.push(['fat_per_100g', dbRow.fat_per_100g, f.fat_per_100g]);
	if (!eqNum(dbRow.carbs_per_100g, f.carbs_per_100g))
		diffs.push(['carbs_per_100g', dbRow.carbs_per_100g, f.carbs_per_100g]);
	if (Number(dbRow.portion_default_g) !== Number(f.portion_default_g))
		diffs.push(['portion_default_g', dbRow.portion_default_g, f.portion_default_g]);
	if (!eqNum(dbRow.cost_per_100g, f.cost_per_100g))
		diffs.push(['cost_per_100g', dbRow.cost_per_100g, f.cost_per_100g]);
	if (!!dbRow.standalone !== !!f.standalone)
		diffs.push(['standalone', dbRow.standalone, f.standalone]);
	if ((dbRow.photo ?? null) !== (f.photo ?? null))
		diffs.push(['photo', dbRow.photo, f.photo]);
	if (!ingredientsEqual(dbRow.ingredients ?? [], fileEntry.ingredients))
		diffs.push(['ingredients', '(см. ниже)', '(см. ниже)']);
	if (debug && diffs.length) {
		console.log(`\n   🔍 diff id=${dbRow.id} «${dbRow.name}»:`);
		for (const [field, a, b] of diffs) {
			if (field === 'ingredients') {
				console.log(`      ingredients DB: ${JSON.stringify(dbRow.ingredients).slice(0, 200)}`);
				console.log(`      ingredients FILE: ${JSON.stringify(fileEntry.ingredients).slice(0, 200)}`);
			} else {
				console.log(`      ${field}: БД=${JSON.stringify(a)} → ФАЙЛ=${JSON.stringify(b)}`);
			}
		}
	}
	return diffs.length > 0;
}

function ingredientsEqual(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b)) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const ia = a[i] ?? {};
		const ib = b[i] ?? {};
		if ((ia.name ?? '') !== (ib.name ?? '')) return false;
		if ((ia.category ?? '') !== (ib.category ?? '')) return false;
		if ((ia.unit ?? '') !== (ib.unit ?? '')) return false;
		const qa = ia.qty == null ? null : Number(ia.qty);
		const qb = ib.qty == null ? null : Number(ib.qty);
		if (qa == null && qb == null) continue;
		if (qa == null || qb == null) return false;
		if (Math.abs(qa - qb) > 0.001) return false;
	}
	return true;
}

function eqNum(a, b, eps = 0.05) {
	if (a == null && b == null) return true;
	if (a == null || b == null) return false;
	return Math.abs(parseFloat(a) - parseFloat(b)) < eps;
}

function confirm(question) {
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(question, (ans) => {
			rl.close();
			const a = (ans || '').trim().toLowerCase();
			resolve(a === 'yes' || a === 'y' || a === 'да' || a === 'д');
		});
	});
}

main().catch((e) => {
	console.error('❌ Сбой:', e);
	process.exit(1);
});
