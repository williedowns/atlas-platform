-- =============================================================
-- Atlas Dealer Demo — Clear test data + seed 6 months realistic data
-- Run in Supabase SQL Editor. Wrapped in a transaction — if any step
-- fails, the whole thing rolls back.
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- PART 1 · CLEAR TEST DATA
-- Delete: 12 test contracts (Willie Downs customers + tiny $1/$3 amounts)
--         Tanger Outlets Tent Sale show
-- Keep: 498 inventory units, all locations, all profiles, products
-- ─────────────────────────────────────────────────────────────

-- Find test contract IDs once and reuse
CREATE TEMP TABLE _test_contract_ids AS
  SELECT c.id
  FROM public.contracts c
  LEFT JOIN public.customers cu ON cu.id = c.customer_id
  WHERE cu.first_name = 'Willie'
     OR (cu.last_name = 'Downs' AND cu.first_name IS NOT NULL)
     OR c.total < 100;

-- Cascade-clean test data
DELETE FROM public.payments
  WHERE contract_id IN (SELECT id FROM _test_contract_ids);

DELETE FROM public.delivery_work_orders
  WHERE contract_id IN (SELECT id FROM _test_contract_ids);

UPDATE public.inventory_units
  SET contract_id = NULL,
      delivery_work_order_id = NULL,
      status = 'at_location'
  WHERE contract_id IN (SELECT id FROM _test_contract_ids);

UPDATE public.leads
  SET converted_contract_id = NULL,
      status = CASE WHEN status = 'converted' THEN 'lost' ELSE status END
  WHERE converted_contract_id IN (SELECT id FROM _test_contract_ids);

DELETE FROM public.contracts
  WHERE id IN (SELECT id FROM _test_contract_ids);

-- Delete test customers
DELETE FROM public.customers
  WHERE first_name = 'Willie' AND last_name = 'Downs';

-- Delete Tanger Outlets show (unlink first)
UPDATE public.leads    SET show_id = NULL WHERE show_id IN (SELECT id FROM public.shows WHERE name ILIKE '%Tanger%');
UPDATE public.contracts SET show_id = NULL WHERE show_id IN (SELECT id FROM public.shows WHERE name ILIKE '%Tanger%');
DELETE FROM public.shows WHERE name ILIKE '%Tanger%';

DROP TABLE _test_contract_ids;

-- ─────────────────────────────────────────────────────────────
-- PART 2 · SEED 6 MONTHS OF REALISTIC DATA
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_org_id          uuid;
  v_rep_ids         uuid[];
  v_location_ids    uuid[];
  v_first_names     text[] := ARRAY[
    'James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda',
    'William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica',
    'Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa',
    'Matthew','Betty','Anthony','Helen','Mark','Sandra','Paul','Donna',
    'Steven','Carol','Andrew','Ruth','Kenneth','Sharon','George','Michelle',
    'Joshua','Laura','Kevin','Emily','Brian','Kimberly','Edward','Deborah',
    'Ronald','Amy','Timothy','Angela','Jason','Brenda','Jeffrey','Emma'
  ];
  v_last_names      text[] := ARRAY[
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
    'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas',
    'Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White',
    'Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young',
    'Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
    'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell',
    'Carter','Roberts','Gomez','Phillips','Evans','Turner','Diaz','Parker'
  ];
  v_street_types    text[] := ARRAY['St','Ave','Blvd','Rd','Dr','Ln','Ct','Way','Pkwy','Trail'];
  v_street_names    text[] := ARRAY[
    'Oak','Maple','Elm','Cedar','Pine','Birch','Willow','Magnolia','Dogwood','Cypress',
    'Highland','Park','River','Lake','Valley','Hillcrest','Meadow','Sunset','Prairie','Ranch',
    'Austin','Houston','Dallas','San Antonio','Travis','Main','Commerce','Market','Broadway','Liberty'
  ];
  v_models          jsonb := jsonb_build_array(
    jsonb_build_object('name','Michael Phelps Legend LSX 800','msrp',18995,'category','hot_tub'),
    jsonb_build_object('name','Michael Phelps Legend LSX 700','msrp',16995,'category','hot_tub'),
    jsonb_build_object('name','Twilight TS 8.25','msrp',12995,'category','hot_tub'),
    jsonb_build_object('name','Twilight TS 7.25','msrp',11495,'category','hot_tub'),
    jsonb_build_object('name','Twilight TS 6.25','msrp',9995,'category','hot_tub'),
    jsonb_build_object('name','Clarity Balance 8','msrp',8995,'category','hot_tub'),
    jsonb_build_object('name','Clarity Balance 7','msrp',7495,'category','hot_tub'),
    jsonb_build_object('name','H2X Challenger 15D','msrp',19995,'category','swim_spa'),
    jsonb_build_object('name','H2X Trainer 19D','msrp',24995,'category','swim_spa'),
    jsonb_build_object('name','MP Signature Momentum','msrp',34995,'category','swim_spa')
  );
  v_colors          text[] := ARRAY['Silver Marble','Midnight Pearl','Sterling Opal','Tuscan Sun','Platinum'];
  v_cabinets        text[] := ARRAY['Espresso','Slate','Cognac','Dark Teak'];
  v_accessories     jsonb := jsonb_build_array(
    jsonb_build_object('name','Cover & Lifter','price',899),
    jsonb_build_object('name','Chemical Starter Kit','price',299),
    jsonb_build_object('name','Steps','price',349),
    jsonb_build_object('name','Delivery & Install','price',750),
    jsonb_build_object('name','Electrical Rough-In','price',1250),
    jsonb_build_object('name','Extended Warranty','price',1495)
  );
  v_customer_ids    uuid[] := ARRAY[]::uuid[];
  v_show_ids        uuid[] := ARRAY[]::uuid[];
  v_contract_ids    uuid[] := ARRAY[]::uuid[];

  v_fn text; v_ln text; v_city text; v_state text; v_zip text;
  v_customer_id uuid; v_rep_id uuid; v_location_id uuid; v_show_id uuid; v_contract_id uuid;
  v_model jsonb; v_model_msrp numeric; v_model_name text; v_color text; v_cabinet text;
  v_subtotal numeric; v_tax numeric; v_total numeric; v_deposit numeric; v_paid numeric; v_balance numeric;
  v_status text; v_created timestamptz; v_contract_no text; v_line_items jsonb;
  v_num_accessories int; v_acc_idx int; v_acc jsonb;
  v_tax_rate numeric := 0.0825;
  v_deposit_pct numeric := 0.30;
  v_show_start date; v_show_end date;
  v_lead_status text; v_lead_show_id uuid; v_converted_contract_id uuid;
  v_iter int;
BEGIN
  -- ── Lookups ─────────────────────────────────────────────────
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'atlas-spas';
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Atlas organization not found (slug=atlas-spas). Seed aborted.';
  END IF;

  SELECT array_agg(id) INTO v_rep_ids
    FROM public.profiles
    WHERE role IN ('admin','manager','sales_rep')
      AND (organization_id = v_org_id OR organization_id IS NULL);
  IF v_rep_ids IS NULL OR array_length(v_rep_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No sales rep profiles found. Seed aborted.';
  END IF;

  SELECT array_agg(id) INTO v_location_ids
    FROM public.locations
    WHERE type = 'store' AND active = true;
  IF v_location_ids IS NULL OR array_length(v_location_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No active store locations found. Seed aborted.';
  END IF;

  -- ── Seed 200 customers ──────────────────────────────────────
  FOR v_iter IN 1..200 LOOP
    v_fn := v_first_names[1 + (floor(random() * array_length(v_first_names, 1)))::int];
    v_ln := v_last_names[1 + (floor(random() * array_length(v_last_names, 1)))::int];

    -- Distribute customers across our 8 store cities
    CASE (v_iter % 8)
      WHEN 0 THEN v_city := 'Plano';         v_state := 'TX'; v_zip := '75024';
      WHEN 1 THEN v_city := 'Fort Worth';    v_state := 'TX'; v_zip := '76102';
      WHEN 2 THEN v_city := 'Georgetown';    v_state := 'TX'; v_zip := '78626';
      WHEN 3 THEN v_city := 'Waco';          v_state := 'TX'; v_zip := '76710';
      WHEN 4 THEN v_city := 'Tyler';         v_state := 'TX'; v_zip := '75701';
      WHEN 5 THEN v_city := 'Ennis';         v_state := 'TX'; v_zip := '75119';
      WHEN 6 THEN v_city := 'Wichita';       v_state := 'KS'; v_zip := '67202';
      WHEN 7 THEN v_city := 'Oklahoma City'; v_state := 'OK'; v_zip := '73102';
    END CASE;

    INSERT INTO public.customers (first_name, last_name, email, phone, address, city, state, zip, organization_id)
    VALUES (
      v_fn, v_ln,
      lower(v_fn) || '.' || lower(v_ln) || v_iter || '@example.com',
      '(' || (200 + floor(random()*800))::int || ') ' ||
        lpad(floor(random()*1000)::int::text,3,'0') || '-' ||
        lpad(floor(random()*10000)::int::text,4,'0'),
      (100 + floor(random()*9900))::int || ' ' ||
        v_street_names[1 + floor(random()*array_length(v_street_names,1))::int] || ' ' ||
        v_street_types[1 + floor(random()*array_length(v_street_types,1))::int],
      v_city, v_state, v_zip,
      v_org_id
    )
    RETURNING id INTO v_customer_id;
    v_customer_ids := v_customer_ids || v_customer_id;
  END LOOP;

  -- ── Seed 8 shows (3 past, 1 live now, 4 upcoming) ──────────
  FOR v_iter IN 1..8 LOOP
    CASE v_iter
      WHEN 1 THEN v_show_start := current_date - 160; v_show_end := v_show_start + 3;
      WHEN 2 THEN v_show_start := current_date - 110; v_show_end := v_show_start + 2;
      WHEN 3 THEN v_show_start := current_date - 60;  v_show_end := v_show_start + 3;
      WHEN 4 THEN v_show_start := current_date - 1;   v_show_end := current_date + 1; -- live now
      WHEN 5 THEN v_show_start := current_date + 14;  v_show_end := v_show_start + 3;
      WHEN 6 THEN v_show_start := current_date + 35;  v_show_end := v_show_start + 2;
      WHEN 7 THEN v_show_start := current_date + 60;  v_show_end := v_show_start + 3;
      WHEN 8 THEN v_show_start := current_date + 90;  v_show_end := v_show_start + 2;
    END CASE;

    INSERT INTO public.shows (name, venue_name, address, city, state, zip, start_date, end_date, active, organization_id)
    VALUES (
      (ARRAY[
        'Dallas Home & Garden Show','Austin Backyard Living Expo','Fort Worth Spring Home Show',
        'Houston Summer Outdoor Expo','Wichita Home & Garden Festival','OKC Backyard & Pool Show',
        'Tyler Outdoor Living Expo','Waco Home Improvement Show'
      ])[v_iter],
      (ARRAY[
        'Kay Bailey Hutchison Convention Center','Austin Convention Center','Will Rogers Memorial Center',
        'NRG Center','Century II Performing Arts','Oklahoma State Fair Park',
        'Harvey Convention Center','Extraco Events Center'
      ])[v_iter],
      '1000 Convention Way',
      (ARRAY['Dallas','Austin','Fort Worth','Houston','Wichita','Oklahoma City','Tyler','Waco'])[v_iter],
      (ARRAY['TX','TX','TX','TX','KS','OK','TX','TX'])[v_iter],
      (ARRAY['75202','78701','76107','77054','67203','73107','75702','76708'])[v_iter],
      v_show_start, v_show_end, true, v_org_id
    )
    RETURNING id INTO v_show_id;
    v_show_ids := v_show_ids || v_show_id;
  END LOOP;

  -- ── Seed 80 contracts across the last 180 days ─────────────
  FOR v_iter IN 1..80 LOOP
    v_customer_id := v_customer_ids[1 + floor(random()*array_length(v_customer_ids,1))::int];
    v_rep_id      := v_rep_ids[1 + floor(random()*array_length(v_rep_ids,1))::int];
    v_location_id := v_location_ids[1 + floor(random()*array_length(v_location_ids,1))::int];

    -- 35% tied to a show (past shows only — can't have a contract from a future show)
    IF random() < 0.35 THEN
      v_show_id := v_show_ids[1 + floor(random()*4)::int]; -- shows 1..4 are past/live
    ELSE
      v_show_id := NULL;
    END IF;

    -- Weighted toward recent: cube of uniform(0,1) * 180 days ago
    v_created := now() - ((random() ^ 0.5) * interval '180 days');

    -- Main model + options
    v_model       := v_models->((floor(random() * jsonb_array_length(v_models)))::int);
    v_model_msrp  := (v_model->>'msrp')::numeric;
    v_model_name  := v_model->>'name';
    v_color       := v_colors[1 + floor(random()*array_length(v_colors,1))::int];
    v_cabinet     := v_cabinets[1 + floor(random()*array_length(v_cabinets,1))::int];

    -- Build line items: main unit + 1-3 accessories
    v_line_items := jsonb_build_array(
      jsonb_build_object(
        'product', v_model_name,
        'color', v_color,
        'cabinet', v_cabinet,
        'qty', 1,
        'unit_price', v_model_msrp,
        'line_total', v_model_msrp
      )
    );
    v_num_accessories := 1 + floor(random()*3)::int;
    FOR v_acc_idx IN 1..v_num_accessories LOOP
      v_acc := v_accessories->((floor(random() * jsonb_array_length(v_accessories)))::int);
      v_line_items := v_line_items || jsonb_build_array(
        jsonb_build_object(
          'product', v_acc->>'name',
          'qty', 1,
          'unit_price', (v_acc->>'price')::numeric,
          'line_total', (v_acc->>'price')::numeric
        )
      );
    END LOOP;

    -- Totals
    v_subtotal := 0;
    FOR v_acc_idx IN 0..(jsonb_array_length(v_line_items) - 1) LOOP
      v_subtotal := v_subtotal + ((v_line_items->v_acc_idx->>'line_total')::numeric);
    END LOOP;
    v_tax      := round(v_subtotal * v_tax_rate, 2);
    v_total    := v_subtotal + v_tax;
    v_deposit  := round(v_total * v_deposit_pct, 2);

    -- Status: weighted random
    v_status := CASE
      WHEN random() < 0.40 THEN 'delivered'
      WHEN random() < 0.60 THEN 'in_production'
      WHEN random() < 0.73 THEN 'ready_for_delivery'
      WHEN random() < 0.85 THEN 'deposit_collected'
      WHEN random() < 0.92 THEN 'signed'
      ELSE 'pending_signature'
    END;

    -- Deposit paid / balance based on status
    CASE v_status
      WHEN 'delivered'            THEN v_paid := v_total;   v_balance := 0;
      WHEN 'ready_for_delivery'   THEN v_paid := v_deposit; v_balance := v_total - v_paid;
      WHEN 'in_production'        THEN v_paid := v_deposit; v_balance := v_total - v_paid;
      WHEN 'deposit_collected'    THEN v_paid := v_deposit; v_balance := v_total - v_paid;
      WHEN 'signed'               THEN v_paid := 0;         v_balance := v_total;
      WHEN 'pending_signature'    THEN v_paid := 0;         v_balance := v_total;
    END CASE;

    v_contract_no := 'AS-' || to_char(v_created,'YYMM') || '-' || lpad(v_iter::text, 4, '0');

    INSERT INTO public.contracts (
      contract_number, status, customer_id, sales_rep_id, show_id, location_id,
      line_items, subtotal, tax_amount, tax_rate, total, deposit_amount, deposit_paid, balance_due,
      payment_method, created_at, updated_at, organization_id,
      signed_at
    )
    VALUES (
      v_contract_no, v_status, v_customer_id, v_rep_id, v_show_id, v_location_id,
      v_line_items, v_subtotal, v_tax, v_tax_rate, v_total, v_deposit, v_paid, v_balance,
      (ARRAY['credit_card','ach','financing','cash'])[1 + floor(random()*4)::int],
      v_created, v_created, v_org_id,
      CASE WHEN v_status NOT IN ('pending_signature') THEN v_created ELSE NULL END
    )
    RETURNING id INTO v_contract_id;
    v_contract_ids := v_contract_ids || v_contract_id;

    -- Payments for contracts past the signing stage
    IF v_status IN ('deposit_collected','in_production','ready_for_delivery','delivered') THEN
      INSERT INTO public.payments (contract_id, amount, method, status, processed_at, created_at)
      VALUES (v_contract_id, v_deposit, 'credit_card', 'completed',
              v_created + interval '1 hour', v_created + interval '1 hour');
    END IF;
    IF v_status = 'delivered' THEN
      INSERT INTO public.payments (contract_id, amount, method, status, processed_at, created_at)
      VALUES (v_contract_id, v_total - v_deposit, 'ach', 'completed',
              v_created + interval '30 days', v_created + interval '30 days');

      -- Delivery work order
      INSERT INTO public.delivery_work_orders (contract_id, scheduled_date, status, completed_at, created_at)
      VALUES (v_contract_id, (v_created + interval '28 days')::date, 'completed',
              v_created + interval '30 days', v_created + interval '25 days');
    ELSIF v_status = 'ready_for_delivery' THEN
      INSERT INTO public.delivery_work_orders (contract_id, scheduled_date, status, created_at)
      VALUES (v_contract_id, (now() + interval '7 days')::date, 'scheduled', v_created + interval '25 days');
    END IF;
  END LOOP;

  -- ── Seed 300 leads ─────────────────────────────────────────
  FOR v_iter IN 1..300 LOOP
    v_fn := v_first_names[1 + floor(random()*array_length(v_first_names,1))::int];
    v_ln := v_last_names[1 + floor(random()*array_length(v_last_names,1))::int];

    v_lead_status := CASE
      WHEN random() < 0.35 THEN 'new'
      WHEN random() < 0.60 THEN 'contacted'
      WHEN random() < 0.75 THEN 'hot'
      WHEN random() < 0.90 THEN 'converted'
      ELSE 'lost'
    END;

    -- 40% came from a show
    IF random() < 0.40 THEN
      v_lead_show_id := v_show_ids[1 + floor(random()*array_length(v_show_ids,1))::int];
    ELSE
      v_lead_show_id := NULL;
    END IF;

    -- Converted leads point to a real contract
    IF v_lead_status = 'converted' AND array_length(v_contract_ids, 1) > 0 THEN
      v_converted_contract_id := v_contract_ids[1 + floor(random()*array_length(v_contract_ids,1))::int];
    ELSE
      v_converted_contract_id := NULL;
    END IF;

    v_rep_id := v_rep_ids[1 + floor(random()*array_length(v_rep_ids,1))::int];
    v_created := now() - ((random() ^ 0.5) * interval '180 days');

    INSERT INTO public.leads (
      show_id, assigned_to, first_name, last_name, phone, email, interest, status,
      converted_contract_id, created_at, updated_at, organization_id
    )
    VALUES (
      v_lead_show_id, v_rep_id, v_fn, v_ln,
      '(' || (200 + floor(random()*800))::int || ') ' ||
        lpad(floor(random()*1000)::int::text,3,'0') || '-' ||
        lpad(floor(random()*10000)::int::text,4,'0'),
      lower(v_fn)||'.'||lower(v_ln)||v_iter||'@example.com',
      (ARRAY['Hot Tub','Swim Spa','Michael Phelps Legend','H2X Fitness','Cold Plunge','Financing Info'])[1 + floor(random()*6)::int],
      v_lead_status,
      v_converted_contract_id,
      v_created, v_created,
      v_org_id
    );
  END LOOP;

  -- ── Sales goals (last 3 months, per rep) — only if table empty
  IF NOT EXISTS (SELECT 1 FROM public.sales_goals LIMIT 1) THEN
    FOR v_iter IN 0..2 LOOP
      INSERT INTO public.sales_goals (rep_id, period_start, period_end, target_revenue, target_contracts, created_at)
      SELECT
        unnest(v_rep_ids),
        (date_trunc('month', now() - (v_iter||' months')::interval))::date,
        (date_trunc('month', now() - (v_iter||' months')::interval) + interval '1 month' - interval '1 day')::date,
        (150000 + floor(random()*150000))::numeric,
        (10 + floor(random()*15))::int,
        now();
    END LOOP;
  END IF;

  RAISE NOTICE 'Seed complete: % customers, % shows, % contracts, 300 leads, sales goals for % reps',
    array_length(v_customer_ids,1),
    array_length(v_show_ids,1),
    array_length(v_contract_ids,1),
    array_length(v_rep_ids,1);
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- Verify counts
-- ─────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.customers)               AS customers,
  (SELECT COUNT(*) FROM public.shows WHERE active)      AS shows,
  (SELECT COUNT(*) FROM public.contracts)               AS contracts,
  (SELECT COUNT(*) FROM public.leads)                   AS leads,
  (SELECT COUNT(*) FROM public.payments)                AS payments,
  (SELECT COUNT(*) FROM public.delivery_work_orders)    AS work_orders;
