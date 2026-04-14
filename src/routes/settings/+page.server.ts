import { fail } from '@sveltejs/kit';
import type { Actions } from './$types.js';
import type { Database } from '$lib/types/database.js';

type PersonaInsert = Database['public']['Tables']['personas']['Insert'];
type PersonaUpdate = Database['public']['Tables']['personas']['Update'];

export const actions: Actions = {
	changePassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');
		const confirm = String(formData.get('confirm') ?? '');

		if (!password || password.length < 6) {
			return fail(400, { error: 'Пароль должен быть не менее 6 символов' });
		}
		if (password !== confirm) {
			return fail(400, { error: 'Пароли не совпадают' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });

		if (error) {
			return fail(400, { error: 'Не удалось обновить пароль. Попробуй ещё раз.' });
		}

		return { success: true };
	},

	createPersona: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { error: 'Не авторизован' });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const noAccount = formData.get('no_account') === '1';

		if (!name) return fail(400, { createError: 'Нужно ввести имя' });

		// Получаем household_id текущего пользователя
		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) {
			return fail(400, { createError: 'Домохозяйство не найдено' });
		}

		const insertData: PersonaInsert = {
			household_id: memberData.household_id,
			user_id: noAccount ? null : user.id,
			created_by_user_id: user.id,
			name,
			gender: 'male',
			age: null,
			weight: null,
			height: null,
			activity: null,
			formula: 'mifflin',
			kcal_target: null,
			protein_target: null,
			fat_target: null,
			carbs_target: null,
			meal_ratios: { bf: 25, ln: 40, dn: 35 },
			carry_dinner_to_lunch: true,
			match_kcal: false
		};

		const { error } = await locals.supabase.from('personas').insert(insertData);

		if (error) return fail(400, { createError: 'Не удалось создать персону: ' + error.message });

		return { createSuccess: true };
	},

	updateLocalPersona: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { error: 'Не авторизован' });

		const formData = await request.formData();
		const personaId = Number(formData.get('persona_id'));
		const name = String(formData.get('name') ?? '').trim();
		const kcalTarget = formData.get('kcal_target');
		const proteinTarget = formData.get('protein_target');
		const fatTarget = formData.get('fat_target');
		const carbsTarget = formData.get('carbs_target');

		if (!personaId) return fail(400, { updateError: 'Неверный ID персоны' });
		if (!name) return fail(400, { updateError: 'Нужно ввести имя' });

		// Получаем household_id текущего пользователя
		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) {
			return fail(400, { updateError: 'Домохозяйство не найдено' });
		}

		const { data: p } = await locals.supabase
			.from('personas')
			.select('id, user_id, created_by_user_id, household_id')
			.eq('id', personaId)
			.single();

		if (!p) return fail(404, { updateError: 'Персона не найдена' });

		if (p.household_id !== memberData.household_id) {
			return fail(403, { updateError: 'Нельзя редактировать эту персону' });
		}

		if (p.user_id !== null || p.created_by_user_id !== user.id) {
			return fail(403, { updateError: 'Нельзя редактировать эту персону' });
		}

		const toNum = (v: FormDataEntryValue | null): number | null => {
			if (v === null || v === '') return null;
			const n = Number(v);
			return isNaN(n) ? null : n;
		};

		const updateData: PersonaUpdate = {
			name,
			kcal_target: toNum(kcalTarget),
			protein_target: toNum(proteinTarget),
			fat_target: toNum(fatTarget),
			carbs_target: toNum(carbsTarget)
		};

		const { error } = await locals.supabase.from('personas').update(updateData).eq('id', personaId);

		if (error) return fail(400, { updateError: 'Не удалось сохранить: ' + error.message });

		return { updateSuccess: true };
	},

	deletePersona: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { error: 'Не авторизован' });

		const formData = await request.formData();
		const personaId = Number(formData.get('persona_id'));

		if (!personaId) return fail(400, { error: 'Неверный ID персоны' });

		// Проверяем что персона — локальная и создана текущим пользователем
		const { data: p } = await locals.supabase
			.from('personas')
			.select('id, user_id, created_by_user_id')
			.eq('id', personaId)
			.single();

		if (!p) return fail(404, { error: 'Персона не найдена' });

		// Разрешаем удалять только локальные персоны (user_id = null), созданные этим пользователем
		if (p.user_id !== null || p.created_by_user_id !== user.id) {
			return fail(403, { error: 'Нельзя удалить эту персону' });
		}

		const { error } = await locals.supabase.from('personas').delete().eq('id', personaId);

		if (error) return fail(400, { error: 'Не удалось удалить персону: ' + error.message });

		return { deleteSuccess: true };
	}
};
