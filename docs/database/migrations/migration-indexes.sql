-- Performance indexes for 10k+ users
-- Run once in Supabase SQL editor

-- Speeds up menu plan lookups by persona + week
CREATE INDEX IF NOT EXISTS idx_menu_plans_persona_week
  ON menu_plans(persona_id, week_label);

-- Speeds up cart state lookups by household + week
CREATE INDEX IF NOT EXISTS idx_cart_state_household_week
  ON cart_state(household_id, week_label);

-- Speeds up food catalog filtering by category
CREATE INDEX IF NOT EXISTS idx_food_catalog_category
  ON food_catalog(category);
