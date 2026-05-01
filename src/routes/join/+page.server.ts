import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types.js';
import type { Household, HouseholdJoinRequest } from '$lib/types/database.js';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();

	if (!session || !user)
		return {
			household: null,
			memberCount: 0,
			alreadyMember: false,
			invalidCode: false,
			hasPendingRequest: false
		};

	const code = url.searchParams.get('code') ?? '';

	if (!code) {
		return {
			household: null,
			memberCount: 0,
			alreadyMember: false,
			invalidCode: true,
			hasPendingRequest: false
		};
	}

	const { data: household } = (await locals.supabase
		.from('households')
		.select('*')
		.eq('invite_code', code)
		.single()) as { data: Household | null; error: unknown };

	if (!household) {
		return {
			household: null,
			memberCount: 0,
			alreadyMember: false,
			invalidCode: true,
			hasPendingRequest: false
		};
	}

	const { count } = await locals.supabase
		.from('household_members')
		.select('id', { count: 'exact', head: true })
		.eq('household_id', household.id);

	const { data: myMembership } = await locals.supabase
		.from('household_members')
		.select('household_id')
		.eq('user_id', user.id)
		.single();

	const alreadyMember = myMembership?.household_id === household.id;

	const { data: existingRequest } = (await locals.supabase
		.from('household_join_requests')
		.select('id, status')
		.eq('household_id', household.id)
		.eq('requester_user_id', user.id)
		.eq('status', 'pending')
		.maybeSingle()) as { data: Pick<HouseholdJoinRequest, 'id' | 'status'> | null; error: unknown };

	return {
		household,
		memberCount: count ?? 0,
		alreadyMember,
		invalidCode: false,
		hasPendingRequest: !!existingRequest
	};
};

export const actions: Actions = {
	joinRequest: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user) return fail(401, { error: 'Не авторизован' });

		const formData = await request.formData();
		const householdId = String(formData.get('household_id') ?? '');

		if (!householdId) return fail(400, { error: 'Неверный запрос' });

		const { data: myMembership } = await locals.supabase
			.from('household_members')
			.select('household_id')
			.eq('user_id', user.id)
			.single();

		if (myMembership?.household_id === householdId) {
			return fail(400, { error: 'Вы уже участник этой семьи' });
		}

		const { data: existing } = await locals.supabase
			.from('household_join_requests')
			.select('id')
			.eq('household_id', householdId)
			.eq('requester_user_id', user.id)
			.eq('status', 'pending')
			.maybeSingle();

		if (existing) {
			return fail(400, { error: 'Заявка уже отправлена. Ожидайте одобрения.' });
		}

		const { data: myPersona } = await locals.supabase
			.from('personas')
			.select('name')
			.eq('user_id', user.id)
			.maybeSingle();

		const { error } = await locals.supabase.from('household_join_requests').insert({
			household_id: householdId,
			requester_user_id: user.id,
			requester_name: myPersona?.name ?? user.email ?? user.id,
			status: 'pending'
		});

		if (error) return fail(400, { error: 'Не удалось отправить заявку: ' + error.message });

		return { requestSent: true };
	}
};
