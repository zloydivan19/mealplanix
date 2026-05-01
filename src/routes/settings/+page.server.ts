import { fail } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import type { Actions, PageServerLoad } from './$types.js';
import type { Database, HouseholdMember, HouseholdJoinRequest, ActivityLevel, Formula, Gender } from '$lib/types/database.js';

type PersonaInsert = Database['public']['Tables']['personas']['Insert'];
type PersonaUpdate = Database['public']['Tables']['personas']['Update'];

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return { members: [], pendingRequests: [] };

	const { data: memberData } = await locals.supabase
		.from('household_members')
		.select('household_id, own_household_id')
		.eq('user_id', user.id)
		.single();

	const householdId = memberData?.household_id;
	const ownHouseholdId = memberData?.own_household_id;
	const isOwner = !!householdId && householdId === ownHouseholdId;

	if (!householdId) return { members: [], pendingRequests: [] };

	const { data: membersData } = await locals.supabase
		.from('household_members')
		.select('id, user_id, household_id, own_household_id, joined_at')
		.eq('household_id', householdId);

	const members = (membersData ?? []) as HouseholdMember[];

	let pendingRequests: HouseholdJoinRequest[] = [];
	if (isOwner) {
		const { data: requestsData } = await locals.supabase
			.from('household_join_requests')
			.select('*')
			.eq('household_id', householdId)
			.eq('status', 'pending')
			.order('created_at', { ascending: true });
		pendingRequests = (requestsData ?? []) as HouseholdJoinRequest[];
	}

	return { members, pendingRequests, isOwner };
};

export const actions: Actions = {
	updateCarryDinner: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { error: 'Не авторизован' });

		const formData = await request.formData();
		const value = formData.get('carry_dinner_to_lunch') === '1';

		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) return fail(400, { error: 'Домохозяйство не найдено' });

		const { error } = await locals.supabase
			.from('households')
			.update({ carry_dinner_to_lunch: value })
			.eq('id', memberData.household_id);

		if (error) return fail(400, { error: 'Не удалось сохранить: ' + error.message });
		return { carryDinnerUpdated: true };
	},

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
		if (!session || !user) return fail(401, { updateError: 'Не авторизован' });

		const formData = await request.formData();
		const personaId = Number(formData.get('persona_id'));
		const name = String(formData.get('name') ?? '').trim();

		if (!personaId) return fail(400, { updateError: 'Неверный ID персоны' });
		if (!name) return fail(400, { updateError: 'Нужно ввести имя' });

		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) return fail(400, { updateError: 'Домохозяйство не найдено' });

		const { data: p } = await locals.supabase
			.from('personas')
			.select('id, user_id, created_by_user_id, household_id')
			.eq('id', personaId)
			.single();

		if (!p) return fail(404, { updateError: 'Персона не найдена' });
		if (p.household_id !== memberData.household_id) return fail(403, { updateError: 'Нельзя редактировать эту персону' });
		if (p.user_id !== null || p.created_by_user_id !== user.id) return fail(403, { updateError: 'Нельзя редактировать эту персону' });

		const toNum = (v: FormDataEntryValue | null): number | null => {
			if (v === null || v === '') return null;
			const n = Number(v);
			return isNaN(n) ? null : n;
		};

		const rawGender = String(formData.get('gender') ?? 'male');
		const gender = (rawGender === 'female' ? 'female' : 'male') as Gender;

		const rawActivity = String(formData.get('activity') ?? 'moderate');
		const validActivities: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
		const activity = (validActivities.includes(rawActivity as ActivityLevel) ? rawActivity : 'moderate') as ActivityLevel;

		const rawFormula = String(formData.get('formula') ?? 'mifflin');
		const formula = (rawFormula === 'harris' ? 'harris' : 'mifflin') as Formula;

		const matchKcal = formData.get('match_kcal') === '1';

		const bf = toNum(formData.get('bf')) ?? 25;
		const ln = toNum(formData.get('ln')) ?? 40;
		const dn = toNum(formData.get('dn')) ?? 35;

		const updateData: PersonaUpdate = {
			name,
			gender,
			age: toNum(formData.get('age')),
			weight: toNum(formData.get('weight')),
			height: toNum(formData.get('height')),
			activity,
			formula,
			match_kcal: matchKcal,
			meal_ratios: { bf, ln, dn },
			kcal_target: toNum(formData.get('kcal_target')),
			protein_target: toNum(formData.get('protein_target')),
			fat_target: toNum(formData.get('fat_target')),
			carbs_target: toNum(formData.get('carbs_target'))
		};

		const { error } = await locals.supabase.from('personas').update(updateData).eq('id', personaId);

		if (error) return fail(400, { updateError: 'Не удалось сохранить: ' + error.message });
		return { updateSuccess: true };
	},

	updateMainPersona: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { updateError: 'Не авторизован' });

		const formData = await request.formData();
		const personaId = Number(formData.get('persona_id'));
		const name = String(formData.get('name') ?? '').trim();

		if (!personaId) return fail(400, { updateError: 'Неверный ID персоны' });
		if (!name) return fail(400, { updateError: 'Нужно ввести имя' });

		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) return fail(400, { updateError: 'Домохозяйство не найдено' });

		const { data: p } = await locals.supabase
			.from('personas')
			.select('id, user_id, household_id')
			.eq('id', personaId)
			.single();

		if (!p) return fail(404, { updateError: 'Персона не найдена' });
		if (p.household_id !== memberData.household_id) return fail(403, { updateError: 'Нет доступа' });
		if (p.user_id !== user.id) return fail(403, { updateError: 'Нельзя редактировать эту персону' });

		const toNum = (v: FormDataEntryValue | null): number | null => {
			if (v === null || v === '') return null;
			const n = Number(v);
			return isNaN(n) ? null : n;
		};

		const rawGender = String(formData.get('gender') ?? 'male');
		const gender = (rawGender === 'female' ? 'female' : 'male') as Gender;

		const rawActivity = String(formData.get('activity') ?? 'moderate');
		const validActivities: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
		const activity = (validActivities.includes(rawActivity as ActivityLevel) ? rawActivity : 'moderate') as ActivityLevel;

		const rawFormula = String(formData.get('formula') ?? 'mifflin');
		const formula = (rawFormula === 'harris' ? 'harris' : 'mifflin') as Formula;

		const matchKcal = formData.get('match_kcal') === '1';
		const bf = toNum(formData.get('bf')) ?? 25;
		const ln = toNum(formData.get('ln')) ?? 40;
		const dn = toNum(formData.get('dn')) ?? 35;

		const updateData: PersonaUpdate = {
			name,
			gender,
			age: toNum(formData.get('age')),
			weight: toNum(formData.get('weight')),
			height: toNum(formData.get('height')),
			activity,
			formula,
			match_kcal: matchKcal,
			meal_ratios: { bf, ln, dn },
			kcal_target: toNum(formData.get('kcal_target')),
			protein_target: toNum(formData.get('protein_target')),
			fat_target: toNum(formData.get('fat_target')),
			carbs_target: toNum(formData.get('carbs_target'))
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

		// Получаем household_id текущего пользователя
		const { data: memberData } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (!memberData?.household_id) {
			return fail(400, { error: 'Домохозяйство не найдено' });
		}

		// Проверяем что персона — локальная и создана текущим пользователем
		const { data: p } = await locals.supabase
			.from('personas')
			.select('id, user_id, created_by_user_id, household_id')
			.eq('id', personaId)
			.single();

		if (!p) return fail(404, { error: 'Персона не найдена' });

		if (p.household_id !== memberData.household_id) {
			return fail(403, { error: 'Нельзя удалить эту персону' });
		}

		// Разрешаем удалять только локальные персоны (user_id = null), созданные этим пользователем
		if (p.user_id !== null || p.created_by_user_id !== user.id) {
			return fail(403, { error: 'Нельзя удалить эту персону' });
		}

		const { error } = await locals.supabase.from('personas').delete().eq('id', personaId);

		if (error) return fail(400, { error: 'Не удалось удалить персону: ' + error.message });

		return { deleteSuccess: true };
	},

	removeMember: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { familyError: 'Не авторизован' });

		const formData = await request.formData();
		const targetUserId = String(formData.get('target_user_id') ?? '');

		const { data: myMember } = await locals.supabase
			.from('household_members')
			.select('household_id, own_household_id')
			.eq('user_id', user.id)
			.single();

		if (!myMember) return fail(400, { familyError: 'Домохозяйство не найдено' });

		if (myMember.household_id !== myMember.own_household_id) {
			return fail(403, { familyError: 'Только владелец может удалять участников' });
		}

		if (targetUserId === user.id) {
			return fail(400, { familyError: 'Нельзя удалить себя' });
		}

		const { error } = await locals.supabase.rpc('remove_household_member', {
			p_target_user_id: targetUserId
		});

		if (error) return fail(400, { familyError: 'Не удалось удалить участника: ' + error.message });
		return { removeMemberSuccess: true };
	},

	leaveFamily: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { familyError: 'Не авторизован' });

		const { data: myMember } = await locals.supabase
			.from('household_members')
			.select('household_id, own_household_id')
			.eq('user_id', user.id)
			.single();

		if (!myMember) return fail(400, { familyError: 'Домохозяйство не найдено' });

		if (myMember.household_id === myMember.own_household_id) {
			return fail(400, { familyError: 'Вы уже в своём домохозяйстве' });
		}

		const { error } = await locals.supabase.rpc('leave_household', {});

		if (error) return fail(400, { familyError: 'Не удалось выйти: ' + error.message });
		return { leaveFamilySuccess: true };
	},

	refreshInviteCode: async ({ locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { familyError: 'Не авторизован' });

		const { data: myMember } = await locals.supabase
			.from('household_members')
			.select('household_id, own_household_id')
			.eq('user_id', user.id)
			.single();

		if (!myMember || myMember.household_id !== myMember.own_household_id) {
			return fail(403, { familyError: 'Только владелец может обновить код' });
		}

		const newCode = randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars, 32 bits

		const { error } = await locals.supabase
			.from('households')
			.update({ invite_code: newCode })
			.eq('id', myMember.household_id);

		if (error) return fail(400, { familyError: 'Не удалось обновить код: ' + error.message });
		return { newInviteCode: newCode };
	},

	approveRequest: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { familyError: 'Не авторизован' });

		const formData = await request.formData();
		const requestId = String(formData.get('request_id') ?? '');

		const { data: myMember } = await locals.supabase
			.from('household_members')
			.select('household_id, own_household_id')
			.eq('user_id', user.id)
			.single();

		if (!myMember || myMember.household_id !== myMember.own_household_id) {
			return fail(403, { familyError: 'Только владелец может принимать заявки' });
		}

		const { data: joinReq } = await locals.supabase
			.from('household_join_requests')
			.select('requester_user_id, household_id, status')
			.eq('id', requestId)
			.single();

		if (!joinReq) return fail(404, { familyError: 'Заявка не найдена' });
		if (joinReq.household_id !== myMember.household_id)
			return fail(403, { familyError: 'Нет доступа' });
		if (joinReq.status !== 'pending') return fail(400, { familyError: 'Заявка уже обработана' });

		const { error: rpcError } = await locals.supabase.rpc('approve_household_join', {
			p_request_id: requestId,
			p_requester_user_id: joinReq.requester_user_id,
			p_household_id: myMember.household_id
		});

		if (rpcError) return fail(400, { familyError: 'Не удалось добавить участника: ' + rpcError.message });

		return { approveSuccess: true };
	},

	rejectRequest: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { familyError: 'Не авторизован' });

		const formData = await request.formData();
		const requestId = String(formData.get('request_id') ?? '');

		const { data: myMember } = await locals.supabase
			.from('household_members')
			.select('household_id, own_household_id')
			.eq('user_id', user.id)
			.single();

		if (!myMember || myMember.household_id !== myMember.own_household_id) {
			return fail(403, { familyError: 'Только владелец может отклонять заявки' });
		}

		const { data: joinReq } = await locals.supabase
			.from('household_join_requests')
			.select('household_id, status')
			.eq('id', requestId)
			.single();

		if (!joinReq) return fail(404, { familyError: 'Заявка не найдена' });
		if (joinReq.household_id !== myMember.household_id)
			return fail(403, { familyError: 'Нет доступа' });

		const { error } = await locals.supabase
			.from('household_join_requests')
			.update({ status: 'rejected' })
			.eq('id', requestId);

		if (error) return fail(400, { familyError: 'Не удалось отклонить: ' + error.message });
		return { rejectSuccess: true };
	}
};
