-- ============================================================
-- PlanMeal v5 — Схема базы данных
-- Выполнить в Supabase SQL Editor (новый проект)
-- ============================================================

-- ── 1. ТАБЛИЦЫ ───────────────────────────────────────────────

CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.households (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code text UNIQUE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.household_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_id    uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  own_household_id uuid     REFERENCES public.households(id),
  joined_at       timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE public.personas (
  id                  bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  household_id        uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name                text NOT NULL,
  gender              text CHECK (gender IN ('male', 'female')),
  age                 int,
  weight              numeric,
  height              numeric,
  activity            text CHECK (activity IN ('sedentary','light','moderate','active','very_active')),
  formula             text CHECK (formula IN ('mifflin','harris')) DEFAULT 'mifflin',
  kcal_target         int,
  protein_target      int,
  fat_target          int,
  carbs_target        int,
  meal_ratios           jsonb NOT NULL DEFAULT '{"bf":25,"ln":40,"dn":35}'::jsonb,
  carry_dinner_to_lunch boolean NOT NULL DEFAULT true,
  match_kcal            boolean NOT NULL DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE public.menu_plans (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  persona_id bigint NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  week_label text NOT NULL,
  day_index  smallint NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  meal_key   text NOT NULL CHECK (meal_key IN ('bf', 'ln', 'dn', 'sn')),
  dish_name     text NOT NULL,
  dish_photo    text,
  dish_category text,
  kcal          integer NOT NULL DEFAULT 0,
  protein       integer NOT NULL DEFAULT 0,
  fat           integer NOT NULL DEFAULT 0,
  carbs         integer NOT NULL DEFAULT 0,
  cost          integer,
  grams         integer NOT NULL DEFAULT 0,
  sort_order    smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_plans_persona_week ON public.menu_plans(persona_id, week_label);

CREATE TABLE public.custom_dishes (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  data         jsonb NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.custom_products (
  id           bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  data         jsonb NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.cart_state (
  id              bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  household_id    uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  week_label      text NOT NULL,
  ingredient_name text NOT NULL,
  price           numeric NOT NULL DEFAULT 0,
  is_checked      boolean NOT NULL DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (household_id, week_label, ingredient_name)
);

CREATE TABLE public.household_fridge (
  household_id uuid PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  items        jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE public.household_join_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  requester_user_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name     text NOT NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at         timestamptz DEFAULT now()
);

-- ── 2. RLS ───────────────────────────────────────────────────

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_dishes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_fridge       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_join_requests ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "user reads own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid());

-- household_members
CREATE POLICY "user reads own membership"
  ON public.household_members FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user updates own membership"
  ON public.household_members FOR UPDATE USING (user_id = auth.uid());

-- households (через членство)
CREATE POLICY "member reads household"
  ON public.households FOR SELECT USING (
    id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "owner updates household"
  ON public.households FOR UPDATE USING (
    id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND household_id = own_household_id
    )
  );

-- personas
CREATE POLICY "member reads household personas"
  ON public.personas FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "member inserts persona"
  ON public.personas FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "member updates own or local persona"
  ON public.personas FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
    AND (user_id = auth.uid() OR (user_id IS NULL AND created_by_user_id = auth.uid()))
  );

CREATE POLICY "member deletes own local persona"
  ON public.personas FOR DELETE USING (
    user_id IS NULL AND created_by_user_id = auth.uid()
  );

-- menu_plans (через personas → household_members)
CREATE POLICY "member reads plans"
  ON public.menu_plans FOR SELECT USING (
    persona_id IN (
      SELECT p.id FROM public.personas p
      JOIN public.household_members hm ON hm.household_id = p.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "member inserts plan"
  ON public.menu_plans FOR INSERT WITH CHECK (
    persona_id IN (
      SELECT p.id FROM public.personas p
      JOIN public.household_members hm ON hm.household_id = p.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "member updates plan"
  ON public.menu_plans FOR UPDATE USING (
    persona_id IN (
      SELECT p.id FROM public.personas p
      JOIN public.household_members hm ON hm.household_id = p.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

CREATE POLICY "member deletes plan"
  ON public.menu_plans FOR DELETE USING (
    persona_id IN (
      SELECT p.id FROM public.personas p
      JOIN public.household_members hm ON hm.household_id = p.household_id
      WHERE hm.user_id = auth.uid()
    )
  );

-- custom_dishes
CREATE POLICY "member reads dishes"
  ON public.custom_dishes FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member inserts dish"
  ON public.custom_dishes FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member deletes dish"
  ON public.custom_dishes FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

-- custom_products
CREATE POLICY "member reads products"
  ON public.custom_products FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member inserts product"
  ON public.custom_products FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member deletes product"
  ON public.custom_products FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

-- cart_state
ALTER TABLE public.cart_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "member reads cart"
  ON public.cart_state FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member upserts cart"
  ON public.cart_state FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member updates cart"
  ON public.cart_state FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member deletes cart"
  ON public.cart_state FOR DELETE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

-- household_fridge
CREATE POLICY "member reads fridge"
  ON public.household_fridge FOR SELECT USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member writes fridge"
  ON public.household_fridge FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "member updates fridge"
  ON public.household_fridge FOR UPDATE USING (
    household_id IN (SELECT household_id FROM public.household_members WHERE user_id = auth.uid())
  );

-- household_join_requests
CREATE POLICY "requester sees own request"
  ON public.household_join_requests FOR SELECT USING (
    requester_user_id = auth.uid()
  );
CREATE POLICY "owner sees incoming requests"
  ON public.household_join_requests FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND household_id = own_household_id
    )
  );
CREATE POLICY "requester inserts request"
  ON public.household_join_requests FOR INSERT WITH CHECK (
    requester_user_id = auth.uid()
  );
CREATE POLICY "requester or owner updates request"
  ON public.household_join_requests FOR UPDATE USING (
    requester_user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM public.household_members
      WHERE user_id = auth.uid() AND household_id = own_household_id
    )
  );
CREATE POLICY "requester deletes own request"
  ON public.household_join_requests FOR DELETE USING (
    requester_user_id = auth.uid()
  );

-- ── 3. ТРИГГЕР: создание домохозяйства при регистрации ────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_household_id uuid;
  v_code         text := '';
  v_chars        text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_alphanum     text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i              int;
BEGIN
  -- 1. Сначала профиль (FK-зависимость для household_members)
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;

  -- 2. Генерируем код формата ABCDE-1X2Y
  FOR i IN 1..5 LOOP
    v_code := v_code || substr(v_chars,   floor(random() * 26 + 1)::int, 1);
  END LOOP;
  v_code := v_code || '-';
  FOR i IN 1..4 LOOP
    v_code := v_code || substr(v_alphanum, floor(random() * 36 + 1)::int, 1);
  END LOOP;

  -- 3. Создаём домохозяйство
  INSERT INTO public.households (invite_code) VALUES (v_code) RETURNING id INTO v_household_id;

  -- 4. Привязываем пользователя (own = active)
  INSERT INTO public.household_members (user_id, household_id, own_household_id)
    VALUES (NEW.id, v_household_id, v_household_id);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
