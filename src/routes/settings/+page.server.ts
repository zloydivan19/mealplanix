import { fail } from '@sveltejs/kit';
import type { Actions } from './$types.js';

export const actions: Actions = {
	changePassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');
		const confirm  = String(formData.get('confirm')  ?? '');

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
	}
};
