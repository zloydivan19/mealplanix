export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type MealKey = 'bf' | 'ln' | 'dn';
export type PlanData = Partial<Record<`${DayKey}_${MealKey}`, number | string>>;

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Formula = 'mifflin' | 'harris';
export type Gender = 'male' | 'female';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface MealRatios {
	bf: number; // % на завтрак
	ln: number; // % на обед
	dn: number; // % на ужин
}

export interface DishData {
	id: string | number;
	name: string;
	cat: 'breakfast' | 'lunch' | 'dinner' | 'snack';
	cost: number; // на 1 персону
	kbju: { k: number; p: number; f: number; c: number };
	ing: Array<{ k: string; a: number; u: string }>; // a = кол-во на 1 персону
	photoUrl?: string;
	fatSecretId?: string;
	source: 'custom' | 'fatsecret';
}

export interface ProductData {
	key: string;
	name: string;
	type: 'pkg' | 'wgt' | 'pcs';
	pkgSize?: number;
	pkgUnit?: string;
	pkgLabel?: string;
	defPrice?: number;
}

export interface FridgeItem {
	type: 'known' | 'custom';
	key?: string; // для known
	name?: string; // для custom
	amount?: number;
	qty?: string;
}

// ── Строки таблиц ────────────────────────────────────────────

export interface Profile {
	id: string;
	created_at: string;
}

export interface Household {
	id: string;
	invite_code: string;
	created_at: string;
}

export interface HouseholdMember {
	id: string;
	user_id: string;
	household_id: string;
	own_household_id: string;
	joined_at: string;
}

export interface Persona {
	id: number;
	household_id: string;
	user_id: string | null;
	created_by_user_id: string | null;
	name: string;
	gender: Gender | null;
	age: number | null;
	weight: number | null;
	height: number | null;
	activity: ActivityLevel | null;
	formula: Formula;
	kcal_target: number | null;
	protein_target: number | null;
	fat_target: number | null;
	carbs_target: number | null;
	meal_ratios: MealRatios;
	carry_dinner_to_lunch: boolean;
	match_kcal: boolean;
	created_at: string;
}

export interface MenuPlan {
	id: number;
	persona_id: number;
	week_label: string;
	day_index: number;
	meal_key: string;
	dish_name: string;
	dish_photo: string | null;
	dish_category: string | null;
	kcal: number;
	protein: number;
	fat: number;
	carbs: number;
	cost: number | null;
	grams: number;
	sort_order: number;
	created_at: string;
}

import type { Dish, DishCategory, ShoppingCategory } from '$lib/types/dish.js';

export type { Dish, DishCategory, ShoppingCategory };

// Данные кастомного блюда в JSONB-колонке (без id, photo, portion_min/max — они дефолтные)
export type CustomDishData = Omit<
	Dish,
	'id' | 'photo' | 'portion_min_g' | 'portion_max_g' | '_custom'
>;

export interface CustomDish {
	id: number;
	household_id: string;
	data: CustomDishData;
	created_at: string;
}

export interface CustomProduct {
	id: number;
	household_id: string;
	data: ProductData;
	created_at: string;
}

export interface HouseholdFridge {
	household_id: string;
	items: FridgeItem[];
	updated_at: string;
}

// Новая строчная модель холодильника (таблица household_fridge)
export interface FridgeRow {
	id: number;
	household_id: string;
	product_name: string;
	qty: number;
	unit: string;
	expires_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface HouseholdJoinRequest {
	id: string;
	household_id: string;
	requester_user_id: string;
	requester_name: string;
	status: JoinRequestStatus;
	created_at: string;
}

// ── Тип Database для Supabase клиента ────────────────────────

// Вспомогательный тип: делает интерфейс совместимым с Record<string, unknown>
// что необходимо для GenericTable constraint в Supabase JS SDK
type AsRecord<T> = { [K in keyof T]: T[K] };

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: AsRecord<Profile>;
				Insert: AsRecord<Omit<Profile, 'created_at'>>;
				Update: AsRecord<Partial<Omit<Profile, 'id'>>>;
				Relationships: [];
			};
			households: {
				Row: AsRecord<Household>;
				Insert: AsRecord<Omit<Household, 'id' | 'created_at'>>;
				Update: AsRecord<Partial<Omit<Household, 'id'>>>;
				Relationships: [];
			};
			household_members: {
				Row: AsRecord<HouseholdMember>;
				Insert: AsRecord<Omit<HouseholdMember, 'id' | 'joined_at'>>;
				Update: AsRecord<Partial<Omit<HouseholdMember, 'id'>>>;
				Relationships: [];
			};
			personas: {
				Row: AsRecord<Persona>;
				Insert: AsRecord<Omit<Persona, 'id' | 'created_at'>>;
				Update: AsRecord<Partial<Omit<Persona, 'id'>>>;
				Relationships: [];
			};
			menu_plans: {
				Row: AsRecord<MenuPlan>;
				Insert: AsRecord<Omit<MenuPlan, 'id'>>;
				Update: AsRecord<Partial<Omit<MenuPlan, 'id'>>>;
				Relationships: [];
			};
			custom_dishes: {
				Row: AsRecord<CustomDish>;
				Insert: AsRecord<Omit<CustomDish, 'id' | 'created_at'>>;
				Update: AsRecord<Partial<Omit<CustomDish, 'id'>>>;
				Relationships: [];
			};
			custom_products: {
				Row: AsRecord<CustomProduct>;
				Insert: AsRecord<Omit<CustomProduct, 'id' | 'created_at'>>;
				Update: AsRecord<Partial<Omit<CustomProduct, 'id'>>>;
				Relationships: [];
			};
			household_fridge: {
				Row: AsRecord<FridgeRow>;
				Insert: AsRecord<Omit<FridgeRow, 'id' | 'created_at' | 'updated_at'>>;
				Update: AsRecord<Partial<Omit<FridgeRow, 'id' | 'household_id' | 'created_at'>>>;
				Relationships: [];
			};
			household_join_requests: {
				Row: AsRecord<HouseholdJoinRequest>;
				Insert: AsRecord<Omit<HouseholdJoinRequest, 'id' | 'created_at'>>;
				Update: AsRecord<Partial<Omit<HouseholdJoinRequest, 'id'>>>;
				Relationships: [];
			};
		};
		Views: Record<string, never>;
		Functions: Record<string, never>;
	};
}
