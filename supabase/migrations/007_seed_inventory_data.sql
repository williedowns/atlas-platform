-- ============================================================
-- Atlas Spas Inventory Seed Data
-- Generated from Google Sheets export (April 2026)
-- Run AFTER migrations 001–006
-- ============================================================

BEGIN;

-- ── Locations (upsert by name) ──────────────────────────────
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Ennis Showroom', 'Ennis', 'TX', '75119', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Tyler Showroom', 'Tyler', 'TX', '75701', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Waco Showroom', 'Waco', 'TX', '76710', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Kansas Showroom', 'Wichita', 'KS', '67202', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('OKC Showroom', 'Oklahoma City', 'OK', '73102', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Georgetown Showroom', 'Georgetown', 'TX', '78626', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Plano Showroom', 'Plano', 'TX', '75024', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Houston Showroom', 'Houston', 'TX', '77001', 'store', true)
  ON CONFLICT (name) DO NOTHING;
INSERT INTO public.locations (name, city, state, zip, type, active)
  VALUES ('Fort Worth Showroom', 'Fort Worth', 'TX', '76102', 'store', true)
  ON CONFLICT (name) DO NOTHING;

-- ── Inventory Units ─────────────────────────────────────────
-- Ennis: C Bal 8 | 2603888 | Pending | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'in_transit', 'stock', '2603888',
   'Tuscan', 'DWAL2', 'WR', 'C Bal 8',
   NULL, 'atlas', 'Tyler Showroom', NULL);

-- Ennis: LSX 800 | 2109968 | Pending | Flores, Julie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2109968',
   'Sterling', 'GRAPH', 'UN', 'LSX 800',
   '[Fierce] This tub belonged to Scott and Jennifer Moore. They sold it to Julie Flores. Storing til she is ready to move to her new house. $50 per month. Pd 1st $50 on 3-20-25 | [Atlas] 3/21 Brought to Ennis for Storage. Came with metal spa steps, cover & filters OCM https://photos.app.goo.gl/Z5ZU6f4H6UX4U4kP9', NULL, 'Flores, Julie', NULL);

-- Ennis: TS 7.25 | 2603952 | Pending | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'in_transit', 'stock', '2603952',
   'Midnight', 'MID2', 'WR', 'TS 7.25',
   NULL, NULL, 'Waco Showroom', NULL);

-- Ennis: TS 8.25 | 2603291 | Pending | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'in_transit', 'stock', '2603291',
   'Midnight', 'MID2', 'WR', 'TS 8.25',
   NULL, 'atlas', 'Tyler Showroom', NULL);

-- Ennis: X Ch15D | H242088 | Pending | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_show', 'stock', 'H242088',
   'Sterling', 'GRAPH', 'WR', 'X Ch15D',
   '[Fierce] this was in the crash with orlando and is no good | [Atlas] 10/1/24 - Robbing pack to replace the one at the State Fair 9/24 Missing Trim & Panels OCM', NULL, NULL, NULL);

-- Ennis: C Bal 6 | 2516545 | Sold | Carter*, Danny/Christy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2516545',
   'Sterling', 'DWAL2', 'UN', 'C Bal 6',
   '[Fierce] 3-16-26 not ready need some more time and wants us to give him a call in a week and half | [Atlas] Delivery Timeframe: 2-4 weeks from 3-14-26
*Contract says sea salt / Graphite for the color, Have Rx', NULL, 'Carter*, Danny/Christy', '7107.17');

-- Ennis: C Bal 7 | 2600417 | Sold | Seals*, Cory
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2600417',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Fierce] SCHLD 4-1-26 | [Atlas] Need RX', NULL, 'Seals*, Cory', 'PIF');

-- Ennis: C Bal 9 | 2603807 | Sold | Zucha*, Heath/Gail
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603807',
   'Sterling', 'GRAPH', 'WR', 'C Bal 9',
   '[Fierce] SCHLD 4-6-26 | [Atlas] Need Rx', NULL, 'Zucha*, Heath/Gail', '13685.71');

-- Ennis: C Bal 9 | 2603409 | Sold | Lee, Chris/Donna
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603409',
   'Sterling', 'GRAPH', 'WR', 'C Bal 9',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: Within 30 days 
Customer is ready, Have Rx', NULL, 'Lee, Chris/Donna', 'PIF');

-- Ennis: CG Valaris Terrain | T250067 | Sold | Bugarin/Flores*, Juan/Sylvia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'T250067',
   'White', 'TAN', 'WR', 'CG Valaris Terrain',
   '[Fierce] 11-5-25 not ready need some more time want us to ck bk at the end of december. LM 12-18-25. 12-19-25 doing construction, ck bk March 15, 2026. LM 3-10-26 LM 3-17-26 | [Atlas] Need Rx; Delivery Time Frame: December | [Expo] This unit will have a 2 year commercial warranty, per contract.', NULL, 'Bugarin/Flores*, Juan/Sylvia', '10730.25');

-- Ennis: CGA Terrain | T260101 | Sold | Clay*, Neil
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'T260101',
   'White', 'TAN', 'WR', 'CGA Terrain',
   '[Fierce] LM 11-26-25 LM 12-8-25. 12-18-25 not ready, ck bk end of Jan. *26 2-2-26 not ready need to get the eletric done and we will ck bk at the end of the month 3-23-26 ck bk next month | [Atlas] Delivery Timeframe: 45 days from 11-14-25', NULL, 'Clay*, Neil', '5525.76');

-- Ennis: G BarH LE | R250400 | Sold | Payne*, Ward/Darlene
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'R250400',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Fierce] schd 4-14-26 | [Atlas] Have Rx, 832-622-5269', NULL, 'Payne*, Ward/Darlene', '5400.0');

-- Ennis: G Ocho CS | R251177 | Sold | Varney*, Jeremiah/Krista
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'R251177',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   '[Fierce] LM 6-3-25 LM 6-23-25 6-25-25 not ready ck bk in a month LM 7-23-25 LM 7-29-25. Lm 8-11-25 LM 8-22-25 LM 9-8-25 9-10-25 not ready they texted and will be a little bit due to them trying to sell their house ck bk in 2 months just to touch base LM 12-1-25 LM 12-8-25--not ready, will let us know when.LM 2-3-26 Not ready at all. 2-3-26 wont be ready for the next 6 months, ck in Aug'' ''26. | [Atlas] Have Rx; NEED 110V cord! 4-30-25 moving, will call us when ready...prob a couple months', NULL, 'Varney*, Jeremiah/Krista', '6607.17');

-- Ennis: LH 6 | 2411228 | Sold | Fowler/Howe*, Amna/Thomas
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2411228',
   'White', 'MID', 'UN', 'LH 6',
   '[Fierce] LM 10-28-25 & TXT not ready they will reach out to us whenever they are ready.LM 12-2-25 12-8-25 TXT, not ready, dealing with city and will get bk with us. ***Husband health is bad and not sure if they can still use hot tub.1-6-25 dont call for another month.Txt. 2-13-26 still waiting on the city. 3-10-26(txt) need to have someone talk about financing options | [Atlas] 3/17 Scratch - Back Right - Acrylic Damage OCM Have Rx', NULL, 'Fowler/Howe*, Amna/Thomas', '5300.0');

-- Ennis: LH 6 | 2517459 | Sold | Tavarez*, Jason/Melinda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2517459',
   'White', 'GRAPH', 'WR', 'LH 6',
   '[Fierce] 6-30-25 not ready ck bk in a month LM/txt 7-30-25. LM 8-22-25. Lm 9-8-25 lm9-15-25. LM 11-26-25 LM 12-8-25. LM/txt 12-18-25.Lm 1-6-26 TXT 1-12-26  TXT 2-3-26 | [Atlas] Have Rx! Live in Robert Lee, TX - Just north of San Angelo', NULL, 'Tavarez*, Jason/Melinda', 'PIF');

-- Ennis: LH 6 | 2517456 | Sold | Custer/Collins*, Kathryn/Mark
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2517456',
   'White', 'GRAPH', 'WR', 'LH 6',
   '[Fierce] 12-2-25 not ready will be ready for the tub delivery in July may call before then | [Atlas] Mandy''s Deal.  Good Deal.  Delivery Time Frame: End of Q1-Beginning of Q2 - builder''s program. Per William, brought in due to model changes.', NULL, 'Custer/Collins*, Kathryn/Mark', 'PIF');

-- Ennis: LH 7 | 2512224 | Sold | Taylor/Martin*, Brent/Mirian
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2512224',
   'Mist', 'MID', 'WR', 'LH 7',
   '[Fierce] 12-3-25 They still want to till March *26 we will ck bk then.3-10-26  not ready still working on their house and wont be ready till late April | [Atlas] Delivery Time Frame is March 2026, but they MUST have a 2025 model (w/ neck jets & foot jets) William gave the OK to order and hold for the customer
Live in Oklahoma | [Expo] DO NOT RESELL TO ANY OTHER CUSTOMER', NULL, 'Taylor/Martin*, Brent/Mirian', '7136.5');

-- Ennis: LSX 700 | 2602527 | Sold | Williams*, Scott
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602527',
   'Sterling', 'GRAPH2', 'WR', 'LSX 700',
   '[Fierce] LM 3-24-26 | [Atlas] Delivery Time Frame: 30-45 days from 2-26-26, Need Rx', NULL, 'Williams*, Scott', 'Need to Print');

-- Ennis: LSX 800 | 2602676 | Sold | Kiser*, Chad
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602676',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Fierce] 3-16-26 not ready just yet he is getting close and will be sooner thay the 30days and he will give us a call back with in 3 weeks if not we will ck bk in may | [Atlas] Delivery Time Frame: 90 days from 2-7-26; 2/24 - Going on vacation today. Getting concrete next week.  Should be ready in 2-3 weeks.', NULL, 'Kiser*, Chad', 'Need to Print');

-- Ennis: LSX 800 | 2604609 | Sold | Price, David/Connie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2604609',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Fierce] Atlas to Deliver 4-13-26 | [Atlas] Have Rx', 'atlas', 'Price, David/Connie', 'PIF');

-- Ennis: LSX 800 | 2600743 | Sold | Tapley, Darren
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2600743',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Fierce] Atlas to Deliver 4-22-26 | [Atlas] Have Rx', 'atlas', 'Tapley, Darren', '15704.34');

-- Ennis: LSX 850 | 2516015 | Sold | Stevens*, Charles
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2516015',
   'Smoky', 'DWAL2', 'WR', 'LSX 850',
   '[Fierce] LM 11-12-25 LM 11-17-25 LM 11-20-25 Not ready need to get his base done and completed and call back in January.LM 1-5-26  LM 1-12-25 1-13-25 not even close to being ready needs a lot more time they said they would give us a call whenever they are ready for delivery | [Atlas] Delivery Time Frame: November.
Was 100% GS, but then had a medical issue and Tim allowed him to keep $10k down, refund the rest to GS, and then will take delivery in November. 
Greensky expired September 2025', NULL, 'Stevens*, Charles', 'PIF');

-- Ennis: LSX 900 | 2603167 | Sold | Schaubert, Brent
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603167',
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Fierce] Atlas to Deliver 4-9-26', 'atlas', 'Schaubert, Brent', 'FF - Need to confirm FF ppw before delivery');

-- Ennis: TS 240X | 2600937 | Sold | Chirino*, Elizabeth
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2600937',
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   '[Fierce] schd 4-7-26 | [Atlas] Have RX.', NULL, 'Chirino*, Elizabeth', '8507.17');

-- Ennis: TS 67.25 | 2604539 | Sold | Gill, Wendy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2604539',
   'Sterling', 'GRAPH2', 'WR', 'TS 67.25',
   '[Fierce] Atlas to Deliver | [Atlas] 3/5 - Alex getting an update,  but siad to go ahead and bring it in on the next truck', 'atlas', 'Gill, Wendy', 'Need to Print');

-- Ennis: TS 7.2 | 2603372 | Sold | McMillan*, Robert
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603372',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] schd 4-3-26 | [Atlas] 3/20 Two Corners Damaged OCM Have Rx', NULL, 'McMillan*, Robert', '8102.17');

-- Ennis: TS 7.2 | 2603654 | Sold | Dryden*, Ben/Mary
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603654',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] 3-19-26 doing landscaping, check back on 4-1-26 | [Atlas] Delivery Timeframe: ASAP', NULL, 'Dryden*, Ben/Mary', 'Need to Print');

-- Ennis: TS 8.2 | 2602715 | Sold | Parrish*, Mike/Genelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602715',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] SCHLD 4-10-26 | [Atlas] Have Rx', NULL, 'Parrish*, Mike/Genelle', 'Need to Print');

-- Ennis: TS 8.2 | 2602721 | Sold | Ragster, Cassandra
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602721',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] Atlas to Deliver | [Atlas] LA DEL, NO RX!
Delivery Timeframe: 30ish Days from 3-13-26
fully foundation deal', 'atlas', 'Ragster, Cassandra', 'Need to Print');

-- Ennis: TS 8.2 | 2603580 | Sold | Deiparine*, Clint/Clair
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603580',
   'Midnight', 'DWAL2', 'WR', 'TS 8.2',
   '[Fierce] LM 3-26-26 | [Atlas] Delivery Time Frame: End of March-End of April, Have Rx', NULL, 'Deiparine*, Clint/Clair', 'Need to Print');

-- Ennis: TS 8.2 | 2602913 | Sold | Van Gundy*, Randy/Jennifer
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602913',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] schd 4-3-26 | [Atlas] Have RX.', NULL, 'Van Gundy*, Randy/Jennifer', 'PIF');

-- Ennis: TS 8.25 | 2518265 | Sold | Hazelip*, Colten/Tristen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2518265',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   '[Fierce] 3-9-26 not ready just need a little bit more time they are redoing their back yard and want us to touch base with them next week and see where they are at 3-23-26 not ready needs two more weeks then call again | [Atlas] Have Rx, DO NOT REASSIGN/SELL TO ANY OTHER CUSTOMER.', NULL, 'Hazelip*, Colten/Tristen', 'PIF');

-- Ennis: TS 8.25 | 2602512 | Sold | Perez/Gonzalez*, Roger/Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602512',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   '[Fierce] 2-18-26 will call in a month to reschedule. 3-18-26 not ready, waiting on permits and doing concrete. ck bk 4/1/26. | [Atlas] Need Rx; Mid March-ish', NULL, 'Perez/Gonzalez*, Roger/Michelle', 'PIF');

-- Ennis: X Ch18D | H251724 | Sold | Diaz*, Julio/Edwina
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H251724',
   'Sterling', 'GRAPH', 'WR', 'X Ch18D',
   '[Fierce] LM 8-18-25 LM 8-27-25 LM 10-15-25 11-10-25 not ready need some more time ck bk in 6 months | [Atlas] Delivery Time Frame: Will give Conner update in July 2025, but delivery will most likely be in Dec 2025.  Nat ordered before they discontinued this model.', NULL, 'Diaz*, Julio/Edwina', '43186.18');

-- Ennis: X Ch18D PRO | H233931 | Sold | Mowrey SS*, Elise
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H233931',
   'Sterling', 'GRAPH', 'WR', 'X Ch18D PRO',
   '[Fierce] 2-2-24 getting concrete poured, call back 2-16-24, LM2-16-24 6-26-25 Not ready just yet need to work on finacing and will call back to schd for delivery if not we will ck bk in 1 month LM 8-27-25 9-8-25 not ready ck bk next month Lm 10-15-25 11-10-25 Not ready she doesnt want us to call her no more but, want us to call her contracter we will be reaching out to him instead, ck bk in 6 months. | [Atlas] Has LSX 900 on order too.  Have RX; Delivery Timeframe: After 4th of July. Will pay remainder of 50% deposit to in-house the rest.', NULL, 'Mowrey SS*, Elise', '33671.52');

-- Ennis: X Ch19D | H243462 | Sold | Mandujano/Lewinski*, Maria/Artur
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H243462',
   'Sterling', 'GRAPH', 'WR', 'X Ch19D',
   '[Fierce] Don''t call yet - per Nat - Will be ready Feb-March 2026 | [Atlas] 4/3 - Delayed w/ house building. Filed for permit. Break ground in May. Warming up to the crane idea. Sending Nat specs to send to crane guys to get a quote. 8/1 - said we can bring the spa through the alley on a flatbed truck.  Said they would just need a spider crane. - said he would get the service/crane. 11/14 - Has a vault now, wants to know where to put the breaker.', NULL, 'Mandujano/Lewinski*, Maria/Artur', '38500.0');

-- Ennis: X T15 | H253242 | Sold | Eason, Karen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H253242',
   'Sterling', 'GRAPH', 'WR', 'X T15',
   '[Fierce] 3/5 OCM Acrylic Damage - Strap Burn https://photos.app.goo.gl/jp1vo6Th25z 

ATLAS TO DELIVER 4-14-26 | [Atlas] 3/5 OCM Acrylic Damage - Strap Burn https://photos.app.goo.gl/jp1vo6Th25zwQ4tP7

LA DEL! NO RX! doing crushed granite base', 'atlas', 'Eason, Karen', 'PIF');

-- Ennis: X T15D | H260042 | Sold | Crawford*, Wes
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260042',
   'Sterling', 'DWAL2', 'WR', 'X T15D',
   '[Fierce] SCHD 4-9-26 | [Atlas] Customer decided to switch to dark walnut exterior color. Customer also upgraded to a taupe roll cover that is at the warehouse. 3/2/26 - Per Nikki, getting concrete done now and is ready to schd for mid march. 
Have Rx

Customer paying with CHECK ON DELIVERY. 4-1-26 Nikki confirmed via text the amount and that our team would ask for the check when they first arrive. | [Expo] *Note for Megan - Need to check corners on this one to see if they are missing something.', NULL, 'Crawford*, Wes', '33202.17');

-- Ennis: X T15D | H253120 | Sold | Longino, Will/Shonna
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H253120',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Fierce] Atlas to Deliver 3-27-26  LA | [Atlas] LA', NULL, 'Longino, Will/Shonna', 'PIF');

-- Ennis: X T15D | H260174 | Sold | Morton*, Rick/Sharon
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260174',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Fierce] LM 3-23-26 LM 3-24-26 | [Atlas] Delivery Time Frame: 4-6 weeks from 2/22/26', NULL, 'Morton*, Rick/Sharon', 'Need to Print');

-- Ennis: X T19D | H242819 | Sold | Lovick*, Chris
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H242819',
   'Sterling', 'ESP', 'WR', 'X T19D',
   '[Fierce] 10-14 CALL BACK NOV 1. 11-6 still not ready, prob end of Nov, we are getting crane quote now so we will be ready 11-19 got crane quote, he will let me know when he is ready LM 7-9-25. 8-12-25 almost ready to schedule, this month, dont sell tub.12-9-25 still waiting on a call back from them | [Atlas] Have Rx; Delivery Timeframe: October. customer has enough open to buy on Greensky if they choose to do so. 8/5 - Customer emailed Tim, "The vault is expected to be completed by the end of the month and will be ready for delivery by mid-September at the latest." 12/24 - Customer''s contractor fell through. Having to find another one after the holidays.', NULL, 'Lovick*, Chris', '31470.77');

-- Ennis: X T19D | H243381 | Sold | Small*, Belinda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H243381',
   'Sterling', 'GRAPH', 'WR', 'X T19D',
   '[Fierce] DO NOT SELL TO ANY OTHER CUSTOMER 6-11-25 Not ready dont call for another 12 to 16 months 2-27-26 house will be ready august/sept this year, doing ss 3-2-26. | [Atlas] Delivery Timeframe: 12 - 18 months from 10-27-23 NOV ''24 - APRIL ''25 (customer building home and supposed to give us 3-4 months notice. 7-25-25  - Customer talked to Mark Long needing specs on the unit for her builder. 2/19/26 - Emailed Nikki "They have finally started working out on my land!  My home should be ready in Aug timeframe.  When is a good time to deliver the spa?  It will be on the back side of the house, away from the county road.  Just want to coordinate the best time since I''m not sure how all that works (i.e. lifting it over the house to set it in place?)." 2-27 Contract address is wrong, it is 479 CR 4310', NULL, 'Small*, Belinda', 'PIF');

-- Ennis: X T19D | H243380 | Sold | Muana*, Keetra/Will
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H243380',
   'Sterling', 'GRAPH', 'WR', 'X T19D',
   '[Fierce] 3-10-25 will not be ready for about 1 year DO NOT TAKE TO A SHOW | [Atlas] Have RX; Paid 30% on GS. Customer is moving to a new house or building one.. not sure.', NULL, 'Muana*, Keetra/Will', '33352.17');

-- Ennis: X T19D | H243113 | Sold | Eldridge, Robert/Barbara
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H243113',
   'Sterling', 'GRAPH', 'UN', 'X T19D',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: Late April, Need RX', 'atlas', 'Eldridge, Robert/Barbara', '4415.21');

-- Ennis: X T21 | H260470 | Sold | Coats*, Mary Ellen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260470',
   'White', 'DWAL2', 'WR', 'X T21',
   '[Fierce] Foundation? SCHLD 4-7-26 | [Atlas] Have RX, PIF', NULL, 'Coats*, Mary Ellen', 'Need to Print');

-- Ennis: X T21D | H253259 | Sold | Akopian/Dudin*, Nionila/Sergei
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H253259',
   'Sterling', 'GRAPH', 'WR', 'X T21D',
   '[Fierce] 1-15-26 in Russia right now. Working on this, already have crane quote. #5 | [Atlas] have Rx; Delivery Time Frame: 1st week of Feb.  Update 2/3/26 - Randy said she is stuck in Russia for antoher momnth. 3/5 - Ready to schedule and run ACH 3/11 - Hold off until Mid April b/c they are building their backyard.', NULL, 'Akopian/Dudin*, Nionila/Sergei', 'Need to Print');

-- Ennis: X Thera 13 | H243335 | Sold | Hartman*, Artrese
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H243335',
   'Sterling', 'ESP', 'UN', 'X Thera 13',
   '[Fierce] schd 9-5-25 (customer postponed delivery) | [Atlas] Have Rx; only has $2k remaining on Greensky account to charge', NULL, 'Hartman*, Artrese', '24447.17');

-- Ennis: X Thera 13 | H251441 | Sold | Demoss*, Lynn
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'blem', 'H251441',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   '[Fierce] SCHLD 4-3-26 | [Atlas] has a scratch on side panel - not fixing, sell as is. 
customer doing CGB; customer is PIF. Conner Brady sold this as a floor model, not blem according to contract. Have Rx', NULL, 'Demoss*, Lynn', 'PIF');

-- Ennis: X Thera 13 | H260421 | Sold | Glach, Michael/Staci
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260421',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   '[Fierce] Atlas to Deliver 4-7-26 b/c CGB live in Beaumont | [Atlas] Crush Granite Base, Have Rx - Pd w/ACH 3/12', 'atlas', 'Glach, Michael/Staci', 'PIF');

-- Ennis: X Thera D | H260080 | Sold | Sorrell, Victoria
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260080',
   'Sterling', 'GRAPH', 'WR', 'X Thera D',
   '[Fierce] Atlas to Deliver per Terri 3-24-26 not ready, end of April | [Atlas] Have Rx; Delivery Timeframe: end of April', 'atlas', 'Sorrell, Victoria', '18507.17');

-- Ennis: C Bal 6 | 2601850 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2601850',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6',
   NULL, NULL, NULL, NULL);

-- Ennis: C Bal 7 | 2601388 | Stock | Is this in Ennis?
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2601388',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   NULL, NULL, 'Is this in Ennis?', NULL);

-- Ennis: C Bal 8 | 2517731 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2517731',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   '[Fierce] 2-18 Orlando said not in Ennis, Abilene show was the last place we have record', NULL, NULL, NULL);

-- Ennis: C Bal 8 | 2516254 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2516254',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   NULL, NULL, NULL, NULL);

-- Ennis: C Prec 7 | 2515959 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2515959',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   NULL, NULL, NULL, NULL);

-- Ennis: CGA Terrain | T260083 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'T260083',
   'White', 'TAN', 'UN', 'CGA Terrain',
   NULL, NULL, NULL, NULL);

-- Ennis: CGA Terrain | T240036 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'T240036',
   'White', 'TAN', 'UN', 'CGA Terrain',
   '[Fierce] 1 panel is being held on for dear life with bungy cord. This unit is missing the cord/plug. Was used for a San Miguel instead. | [Atlas] 1 panel is being held on for dear life with bungy cord. This unit is missing the cord/plug. Was used for a San Miguel instead.', NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251750 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251750',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251746 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251746',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251858 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251858',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251823 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251823',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251225 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251225',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   '[Fierce] cust just wanted to upgrade, nothing wrong with tub', NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251781 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251781',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R251467 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251467',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G San Mig | R251599 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251599',
   'SeaSalt', 'GRAPH', 'WR', 'G San Mig',
   NULL, NULL, NULL, NULL);

-- Ennis: LSX 800 | 2509439 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2509439',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   '[Fierce] 2/4/26 - Hole and Crack along ABS pan https://photos.app.goo.gl/8sfZaek5mWxKeVBD8 | [Atlas] 2/4/26 - Hole and Crack along ABS pan https://photos.app.goo.gl/8sfZaek5mWxKeVBD8', NULL, NULL, NULL);

-- Ennis: SG MP 2 | 25070089 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '25070089',
   'N/A', 'N/A', 'WR', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- Ennis: SG MP 2 | 250800034 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '250800034',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- Ennis: SG MP 2 | 250800015 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '250800015',
   'N/A', 'N/A', 'WR', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- Ennis: SG MP 3 | 240200141 | Stock | Can't send back.
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '240200141',
   NULL, NULL, 'UN', 'SG MP 3',
   '[Fierce] 10/22/24 - scratches, indentations, cracks from going to shows; https://photos.app.goo.gl/5X7hSRCQTiXt5SqWA | [Atlas] 10/22/24 - scratches, indentations, cracks from going to shows; https://photos.app.goo.gl/5X7hSRCQTiXt5SqWA 1/2 Not in Ennis along with Tyler, and Waco waiting on confirmation for Denton show tubs OCM. 2/25/25 - Not in Ennis, Not in Waco 12/11/25 Not in Ennis OCM', NULL, 'Can''t send back.', NULL);

-- Ennis: SG MP 3C | 250400218 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '250400218',
   'N/A', 'N/A', 'WR', 'SG MP 3C',
   NULL, NULL, NULL, NULL);

-- Ennis: TS 7.25 | 2516503 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2516503',
   'Smoky', 'GRAPH', 'UN', 'TS 7.25',
   '[Fierce] DO NOT SELL - LEAK | [Atlas] Megan, are we RMA''ing this?', NULL, NULL, NULL);

-- Ennis: TS 8.2 | 2513551 | Stock | Cleburne, NOT IN ENNIS - WHERE IS THIS UNIT?
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2513551',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] s | [Atlas] 12/11/25 Not in Ennis OCM', NULL, 'Cleburne, NOT IN ENNIS - WHERE IS THIS UNIT?', NULL);

-- Ennis: TS 8.2 | 2601361 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2601361',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, NULL, NULL);

-- Ennis: TS 8.25 | 2518171 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2518171',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   '[Fierce] front panel has large black strip marks on it 2/13/26 OCM Support Frame is broken https://photos.app.goo.gl/i4BoaoiLEmrN1U5x7 | [Atlas] front panel has large black strip marks on it 2/13/26 OCM Support Frame is broken https://photos.app.goo.gl/i4BoaoiLEmrN1U5x7', NULL, NULL, NULL);

-- Ennis: TS 8.25 | 2517703 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2517703',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   '[Atlas] Corner Damage and strap burn', NULL, NULL, NULL);

-- Ennis: X Ch15D | H220017 | Stock | SELL AS IS, SELL AS IS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'H220017',
   'Sierra', 'GRAPH', 'UN', 'X Ch15D',
   '[Fierce] 12/19 electrical hole, latch for smartop OCM https://photos.app.goo.gl/iHYkdhY9X8FLVG9A8 | [Atlas] 12/19 electrical hole, latch for smartop OCM https://photos.app.goo.gl/iHYkdhY9X8FLVG9A8', NULL, 'SELL AS IS, SELL AS IS', 'Sell as is');

-- Ennis: X Ch15D | H240491 | Stock | SELL AS IS, SELL AS IS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'wet_model', 'H240491',
   'Sterling', 'GRAPH', 'UN', 'X Ch15D',
   '[Fierce] WET MODEL E2E Roll Cover & clips installed 10/26 Acrylic Damage and Soft Tread Indention OCM https://photos.app.goo.gl/j7SRoVYYa3vqTaDE7 | [Atlas] WET MODEL E2E Roll Cover & clips installed 10/26 Acrylic Damage and Soft Tread Indention OCM https://photos.app.goo.gl/j7SRoVYYa3vqTaDE7', NULL, 'SELL AS IS, SELL AS IS', 'Sell as is');

-- Ennis: X T15D | H222921 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'H222921',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Fierce] Need to wet test/check out before selling.  Not sure what is wrong with this unit, if anything. | [Atlas] Need to wet test/check out before selling.  Not sure what is wrong with this unit, if anything.', NULL, NULL, 'Warehouse Team');

-- Ennis: X T21D | H252718 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'H252718',
   'White', 'GRAPH', 'UN', 'X T21D',
   '[Fierce] 2/4/26 - Acrylic Shell has strap burns on each of the 21'' sides. Fork lift went in the side panel - Need to replace, along with 1 other panel and 1 fillet. - Per Chris 3/2 OCM Acrylic Damage - Strap Burn https://photos.app.goo.gl/XGVhGQxvWRyxb171A | [Atlas] 2/4/26 - Acrylic Shell has strap burns on each of the 21'' sides. Fork lift went in the side panel - Need to replace, along with 1 other panel and 1 fillet. - Per Chris 3/2 OCM Acrylic Damage - Strap Burn https://photos.app.goo.gl/XGVhGQxvWRyxb171A', NULL, NULL, NULL);

-- Ennis: TS 8.2 | 2600973 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2600973',
   'Tuscan', 'DWAL2', 'UN', 'TS 8.2',
   '[Fierce] Need Skirting from this tub for Troy/Kristie Cole @ Rockwall Show.. Fierce picking up on 3/26/26 to bring to Ennis on 3/28/26 | [Expo] Waco Warehouse', NULL, NULL, NULL);

-- Ennis: C Prec 7 | 2601954 | Sold | Ogle*, William
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2601954',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Fierce] 3/11/26 Scratches - Acrylic Damage OCM https://photos.app.goo.gl/9f6oFo3bZ159cPCU6 | [Atlas] 3/11/26 Scratches - Acrylic Damage OCM https://photos.app.goo.gl/9f6oFo3bZ159cPCU6 | [Expo] Crush Cranite Base 
Delivery in 30 days - Tyler Delivery', NULL, 'Ogle*, William', 'Cant contact number doesnt work');

-- Ennis: X T12 | H251292 | Sold | Gridley/Dietrich*, Daniel/Diana
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H251292',
   'Sterling', 'GRAPH', 'UN', 'X T12',
   '[Fierce] SITE SURVEY 3-31-26 | [Atlas] Dirty softread . Strap burns left and right sides Need Rx | [Expo] Delivery Early May
Crush Granite Base', NULL, 'Gridley/Dietrich*, Daniel/Diana', '$29,512.01 + $1753.65 CGB');

-- Ennis: X T21D | H260256 | Sold | Whitson*, Claud/Dana
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260256',
   'White', 'GRAPH2', 'UN', 'X T21D',
   '[Fierce] schd 4-4-26 | [Atlas] N3/27 - 8'' LED bar on the skirting on the end of the swim spa side is missing. 1 corner LED is missing https://photos.app.goo.gl/RCAf2Cg2dsZQds2A9 Need Rx | [Expo] Delivery 1 to 2 weeks 
Crush Granite Base', NULL, 'Whitson*, Claud/Dana', '4466.72');

-- Ennis: X Thera 13 | H252815 | Sold | Gloria*, Guzman
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H252815',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   '[Atlas] Need Rx, IN HOUSE NOT SIGNED', NULL, 'Gloria*, Guzman', '2475.0');

-- Ennis: LSX 800 | 2414185 | Sold | Darlington*, Leslie/Priscilla
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2414185',
   'Sterling', 'GRAPH', 'UN', 'LSX 800',
   '[Fierce] Fierce to Deliver AFTER we get the LED Light strand fixed. | [Atlas] Delivery Time Frame: 30-45 days. 
10-30-25 - need LED light strand. colton knows.', NULL, 'Darlington*, Leslie/Priscilla', 'Service Techs or Warehouse Team?');

-- Ennis: TS 8.2 | 2600778 | Sold | Cole*, Troy/Kristie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2600778',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   '[Fierce] schd 4-9-26 | [Atlas] Have Rx', NULL, 'Cole*, Troy/Kristie', 'PIF');

-- Ennis: TS 240X | 2602106 | Sold | Clark*, James
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2602106',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   NULL, NULL, 'Clark*, James', NULL);

-- Ennis: LSX 900 | 2503929 | Sold | Ndikum*, Yannick
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2503929',
   'Sterling', 'MID2', 'UN', 'LSX 900',
   '[Fierce] SCHLD 4-2-26 | [Atlas] Owes Rx; Colton''s customer, Have Rx', NULL, 'Ndikum*, Yannick', 'PIF');

-- Ennis: TS 240X | 2518138 | Sold | Clark, James
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2518138',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   '[Atlas] Have RX', NULL, 'Clark, James', 'PIF');

-- Ennis: C Prec 8 | 2518105 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2518105',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   NULL, NULL, NULL, NULL);

-- Ennis: X T15D | H2602454 | Sold | Hurst, William
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H2602454',
   'Sterling', 'GRAPH2', 'WR', 'X T15D',
   '[Fierce] Atlas to Deliver | [Atlas] LA DEL, NO RX!
Delivery Timeframe: 30-45 days from 3-13-26
customer also doing crushed granite base', 'atlas', 'Hurst, William', 'Need to Print');

-- Ennis: X T15D | H260459 | Sold | Faulkner, Peter
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260459',
   'Sterling', 'GRAPH2', 'WR', 'X T15D',
   '[Fierce] Atlas to Deliver | [Atlas] LA DEL, NO RX!
Delivery Timeframe: 30-45 days from 3-13-26', 'atlas', 'Faulkner, Peter', 'Need to Print');

-- Ennis: LSX 700 | 2604707 | Sold | Williams, Melinda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2604707',
   'Sterling', 'GRAPH2', 'WR', 'LSX 700',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: Beg of May, PIF, Have Rx', 'atlas', 'Williams, Melinda', 'Need to Print');

-- Ennis: TS 8.2 | 2603567 | Sold | Whitlock*, Steven/Carol
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603567',
   'Smoky', 'MID2', 'WR', 'TS 8.2',
   '[Fierce] LM 3-31-26 | [Atlas] Delivery Time Frame: April. Will put down remaining deposit once house is closed in March', NULL, 'Whitlock*, Steven/Carol', 'Need to Print');

-- Ennis: TS 8.2 | 2603213 | Sold | Muller, Charles/Deanna
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603213',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] Atlas to Deliver 4-17-26 | [Atlas] Delivery Time Frame:  30 days from 3/6/26', 'atlas', 'Muller, Charles/Deanna', NULL);

-- Ennis: C Prec 7 | 2603723 | Sold | Gregg*, Richard/Laurie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603723',
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   '[Fierce] LM 3-31-26 | [Atlas] Delivery Time Frame: 90 days from 1-11-26 , Have Rx', NULL, 'Gregg*, Richard/Laurie', 'PIF');

-- Ennis: C Bal 7 | 2603590 | Sold | Nix, Hootie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603590',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Fierce] Atlas to Deliver | [Atlas] 3/20 Two Corners Damaged OCM

Delivery Time Frame: 4-6 weeks from 2/17/26', 'atlas', 'Nix, Hootie', 'Need to Print');

-- Ennis: LH L6 | 2604766 | Sold | Mitchell, Mike/Adriana
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2604766',
   'White', 'GRAPH', 'WR', 'LH L6',
   '[Fierce] Atlas to Deliver 4-16-26 | [Atlas] Customer is ready!', 'atlas', 'Mitchell, Mike/Adriana', NULL);

-- Ennis: G Ocho SE | R260374 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R260374',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho SE',
   NULL, NULL, NULL, NULL);

-- Ennis: LSX 800 | 2501492 |  | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2501492',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   '[Fierce] 3/30 ABS Damage OCM https://photos.app.goo.gl/kbjny46hv5YAR8p29 | [Atlas] 3/30 ABS Damage OCM https://photos.app.goo.gl/kbjny46hv5YAR8p29', NULL, NULL, NULL);

-- Ennis: C Prec 8 | 2510592 | Sold | Wichman*, Jeff/Karen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2510592',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   '[Fierce] SCHLD 4-4-26 
No hot tub steps
Sending Swim spa steps (they have a T15D H214620) | [Atlas] Have RX.  Sold with chip in shell. Customer saw it, signed off on it', NULL, 'Wichman*, Jeff/Karen', 'PIF');

-- Ennis: C Bal 7 | 2602249 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2602249',
   'Sterling', 'DWAL2', 'WR', 'C Bal 7',
   '[Fierce] IS GRAPHITE - DWAL SWITCHED TO P7 FOR PHIL SHINALT -NATALIE ORDERED PHIL SHINALT', NULL, NULL, NULL);

-- Ennis: C Bal 8 | 2602958 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2602958',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   NULL, NULL, NULL, NULL);

-- Ennis: C Bal 9 | 2510573 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2510573',
   'Sterling', 'GRAPH', 'UN', 'C Bal 9',
   '[Fierce] 3/30 Acrylic Damage - Strap Burn OCM https://photos.app.goo.gl/iC2vUE2irzvnFvGG9 | [Atlas] 3/30 Acrylic Damage - Strap Burn OCM https://photos.app.goo.gl/iC2vUE2irzvnFvGG9', NULL, NULL, NULL);

-- Ennis: C Prec 7 | 2601301 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2601301',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Fierce] Vanish cover lifter installed | [Atlas] Vanish cover lifter installed | [Expo] Vanish cover lifter installed', NULL, NULL, NULL);

-- Ennis: C Prec 8 | 2517829 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2517829',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   NULL, NULL, NULL, NULL);

-- Ennis: G Ocho CS | R241721 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R241721',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- Ennis: G San Mig | R251366 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'R251366',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   NULL, NULL, NULL, NULL);

-- Ennis: LH S7 | 2600380 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2600380',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, NULL, NULL);

-- Ennis: LSX 800 | 2517367 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2517367',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   NULL, NULL, NULL, NULL);

-- Ennis: TS 7.2 | 2502431 | Stock | SALT SYSTEM INSTALLED, SALT SYSTEM INSTALLED
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2502431',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Fierce] SALT SYSTEM INSTALLED | [Atlas] SALT SYSTEM INSTALLED Light bar was replaced 3-6-26', NULL, 'SALT SYSTEM INSTALLED, SALT SYSTEM INSTALLED', NULL);

-- Ennis: TS 8.2 | 2604156 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2604156',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, NULL, NULL);

-- Ennis: TS 8.25 | 2601837 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2601837',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   '[Fierce] 3/23 Acrylic Damage OCM https://photos.app.goo.gl/YM5VjSR3KZBaL9zh6 | [Atlas] 3/23 Acrylic Damage OCM https://photos.app.goo.gl/YM5VjSR3KZBaL9zh6', NULL, NULL, NULL);

-- Ennis: X T12 | H250650 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'H250650',
   'Sterling', 'GRAPH', 'UN', 'X T12',
   '[Fierce] 2/27/26 - Strap marks on skirting & acrylic damage https://photos.app.goo.gl/EK5bYZtvAp4QdEvy5 | [Atlas] Orlando says its missing the 8ft end  https://photos.app.goo.gl/pd32tr9oDYadNYsdA', NULL, NULL, NULL);

-- Ennis: X T15D | H252641 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'H252641',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Fierce] 3/30 Acrylic Damage - Strap Burn OCM https://photos.app.goo.gl/7QsT3JS3EC8uV84n8 | [Atlas] 3/30 Acrylic Damage - Strap Burn OCM https://photos.app.goo.gl/7QsT3JS3EC8uV84n8', NULL, NULL, NULL);

-- Ennis: X T21D | H260333 | Sold | McGregor*, Estuardo
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260333',
   'White', 'GRAPH', 'WR', 'X T21D',
   '[Fierce] concrete 1st | [Atlas] getting concrete done and decking done with Alex. Need to get in touch with Alex on when concrete is done to then schedule delivery
Nikki confirmed graphite color with Mark', NULL, 'McGregor*, Estuardo', 'Need to Print');

-- Ennis: X T15D | H260241 | Sold | Cone, Allen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', 'H260241',
   'Sterling', 'GRAPH2', 'WR', 'X T15D',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Timeframe: 45-60 days from 3-13-26
customer also doing crushed granite base', 'atlas', 'Cone, Allen', 'Need to Print');

-- Ennis: SG MP 2 | 240900047 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '240900047',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   '[Expo] Was Tyler showroom floor model', NULL, NULL, 'Tyler');

-- Ennis: TS 8.2 | 2603210 | Sold | Howell*, Judy/Kenny
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603210',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Atlas] Delivery Time Frame: 2-4 weeks from 3-29-26', NULL, 'Howell*, Judy/Kenny', 'Need to Print');

-- Ennis: TS 6.2 | 2605025 | Sold | Hanna, Karlena
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2605025',
   'Sterling', 'GRAPH2', 'WR', 'TS 6.2',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: 3-4 weeks from 3-29-26', 'atlas', 'Hanna, Karlena', 'Need to Print');

-- Ennis: C Prec 7 | 2603722 | Sold | Shinalt, Phil
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603722',
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   '[Fierce] Atlas to Deliver -
Swapping skirting w/ 2602249 in Ennis to make this unit DW', 'atlas', 'Shinalt, Phil', 'Need to Print');

-- Ennis: C Bal 6 CS | 2517028 | Pending | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2517028',
   'Smoky', 'GRAPH', 'WR', 'C Bal 6 CS',
   NULL, 'atlas', 'Tyler Showroom', NULL);

-- Ennis: LH S7 | 2603076 | Pending | Georgetown Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', '2603076',
   'White', 'MID', 'WR', 'LH S7',
   NULL, NULL, 'Georgetown Showroom', NULL);

-- Ennis: LH L7 | 2603449 | Sold | George, Thomas/Angela
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'allocated', 'stock', '2603449',
   'White', 'GRAPH', 'WR', 'LH L7',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: 3-4 weeks from 3-29-26', 'atlas', 'George, Thomas/Angela', 'Need to Print');

-- Ennis: CGA Glacier | T260023 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Ennis Showroom' LIMIT 1), 'at_location', 'stock', 'T260023',
   'Grey', 'GREY', 'UN', 'CGA Glacier',
   '[Expo] Was Cowboys Football Fit Gym', NULL, NULL, NULL);

-- Tyler: C Bal 6 | 2517611 | Sold | Dempsey, Grafton
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2517611',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6',
   '[Atlas] 3/11 - Per Ken, Lisa (wife) said her husband has been in the hospital. She will call when she is ready for delivery.  Her number is 318-348-5613', 'atlas', 'Dempsey, Grafton', 'PIF');

-- Tyler: C Bal 6 CS | 2602236 | Sold | Longoria/Bailey, Ray/Ken
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2602236',
   'Smoky', 'DWAL2', 'UN', 'C Bal 6 CS',
   '[Atlas] Have Rx | [Expo] on the floor', 'atlas', 'Longoria/Bailey, Ray/Ken', 'PIF');

-- Tyler: C Bal 9 | 2603027 | Sold | Larusso, Cynthia/Anthony
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603027',
   'Sterling', 'GRAPH', 'WR', 'C Bal 9',
   '[Atlas] Delivery Time Frame: 30 days from 2-20-26', 'atlas', 'Larusso, Cynthia/Anthony', 'Need to Print');

-- Tyler: G San Mig | R251290 | Sold | Jackson, Martha
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'R251290',
   'SeaSalt', 'GRAPH', 'WR', 'G San Mig',
   '[Atlas] Have Rx, In-House signed | [Expo] on the floor or in the back?', 'atlas', 'Jackson, Martha', 'PIF');

-- Tyler: LH 7 | 2517553 | Sold | Moses, Donnie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2517553',
   'White', 'GRAPH', 'UN', 'LH 7',
   '[Atlas] LA DEL! NO RX! Delivery Timeframe: 2 weeks from 7-19-25; customer having concrete poured, Lindy, start ACH draft when spa is scheduled for delivery! | [Expo] Have not heard from customer since August. - on the floor', 'atlas', 'Moses, Donnie', '9390.49');

-- Tyler: LH 7 | 2600571 | Sold | Slack, John/Temarind
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2600571',
   'White', 'GRAPH', 'WR', 'LH 7',
   '[Atlas] Have Rx; customer has to have neck and shoulder jets per Blake as Nikki asked. | [Expo] March/April - DO NOT REASSIGN. on the floor', 'atlas', 'Slack, John/Temarind', 'PIF');

-- Tyler: LH L7 | 2602981 | Sold | Barkley, Charles
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2602981',
   'White', 'GRAPH', 'WR', 'LH L7',
   '[Atlas] Delivery Time Frame: waiting to hear back from VA, then will be ready to schedule.', 'atlas', 'Barkley, Charles', '5946.5');

-- Tyler: LSX 800 | 2600593 | Sold | Smith, Michael Leon
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2600593',
   'Smoky', 'MID2', 'WR', 'LSX 800',
   '[Atlas] Delivery Timeframe: January/February 2026; 2 booster seats, and upright lifter, Have Rx | [Expo] Wants to pick it up in 2 weeks, around 3-25-26.  KEEP WRAPPED! in the back', 'atlas', 'Smith, Michael Leon', 'PIF');

-- Tyler: SG MP 3C | 250400195 | Sold | Goerke, Cynthia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '250400195',
   'N/A', 'N/A', 'WR', 'SG MP 3C',
   '[Atlas] Need RX Only!', 'atlas', 'Goerke, Cynthia', '709.09');

-- Tyler: TS 240X | 2603173 | Sold | Loera, Matthew
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603173',
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   '[Atlas] Delivery Time Frame: 3-4 weeks from 2-20-26, Have Rx, customer not sure about CGB yet | [Expo] @Home office', 'atlas', 'Loera, Matthew', 'Need to Print');

-- Tyler: TS 240X | 2603175 | Sold | Ferrell, Lisa/Mike
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603175',
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   '[Atlas] Have Rx | [Expo] @Home office', 'atlas', 'Ferrell, Lisa/Mike', '12507.17');

-- Tyler: TS 240X | 2602131 | Sold | Parks, Henry
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2602131',
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   '[Atlas] 3/19 Two Corners Damaged OCM
Delivery Timeframe: 3-4 weeks from 3-15-26', 'atlas', 'Parks, Henry', 'PIF - Tyler');

-- Tyler: TS 6.2 | 2602690 | Sold | Taylor, Kevin
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2602690',
   'Sterling', 'GRAPH2', 'WR', 'TS 6.2',
   '[Atlas] Have Rx | [Expo] in the back', 'atlas', 'Taylor, Kevin', 'PIF');

-- Tyler: TS 7.2 | 2008995 | Sold | Jacob- KS, Rob
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2008995',
   'Sterling', 'GRAPH', 'UN', 'TS 7.2',
   '[Atlas] 3/25 - Per Chris, Rodent Damage, leaking a lot | [Expo] Tyler store in the back', NULL, 'Jacob- KS, Rob', 'Chris 3-25-25 - fix asap

PIF');

-- Tyler: TS 7.25 | 2603553 | Sold | Frith, Elizabeth
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603553',
   'Sterling', 'DWAL2', 'WR', 'TS 7.25',
   '[Atlas] 3/5/26 OCM Two corners damaged - Breeland is her cousin who Atlas delivered previously and needs service- on terri''s calendar but I don''t know if she actually talked to Breeland yet. | [Expo] @Home office', 'atlas', 'Frith, Elizabeth', '13179.01');

-- Tyler: TS 8.25 | 2517405 | Sold | Gunter, Carl/Martha
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2517405',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   '[Atlas] Have Rx, Customer making final payment with Mark at spa store 12/19/25', 'atlas', 'Gunter, Carl/Martha', 'Need to Print');

-- Tyler: TS 8.25 | 2503353 | Sold | Carver, Eric/Tricia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2503353',
   'Smoky', 'GRAPH2', 'UN', 'TS 8.25',
   '[Atlas] Have RX | [Expo] on the floor', NULL, 'Carver, Eric/Tricia', 'PIF');

-- Tyler: TS 8.25 | 2603780 | Sold | Heterich, Ernest/Lisa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603780',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   '[Atlas] Delivery Time Frame: 4-6 weeks from 3/6/26 | [Expo] @Home office', 'atlas', 'Heterich, Ernest/Lisa', 'Need to Print');

-- Tyler: TS 8.25 | 2602228 | Sold | Pitman, Philip/Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2602228',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   '[Atlas] Delivery Time Frame: 45 days from 2-20-26 | [Expo] @Home office', 'atlas', 'Pitman, Philip/Michelle', 'Need to Print');

-- Tyler: X T12 | H180280 | Sold | Velazquez-KS, Luis/Kimberlee
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H180280',
   'Sterling', 'ESP', 'UN', 'X T12',
   '[Atlas] 9/27 - Metal Tether ring section is completely rusted 11/13 - No leak anymore. Pulled up soft tread. Needs thorough cleaning. Need trim upgrade. STILL NEED METAL TETHER RING. https://photos.app.goo.gl/1387jBDX7psc7y2c9 

Delivery Timeframe: ASAP; when pad is done. customer lives in KS | [Expo] @Home office', NULL, 'Velazquez-KS, Luis/Kimberlee', 'NEW order. Sending to Plano. Need done ASAP. P206107
Chris 3-25-26');

-- Tyler: X T15D | H253044 | Sold | Batson, Dale/Pam
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H253044',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Atlas] Have Rx | [Expo] @Home office', 'atlas', 'Batson, Dale/Pam', 'PIF');

-- Tyler: X T15D | H252918 | Sold | Davis, Carl/Sheila
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H252918',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Atlas] Have Rx | [Expo] @Home office', 'atlas', 'Davis, Carl/Sheila', 'PIF');

-- Tyler: X T15D | H230198 | Sold | Lockwood-KS, Sue & Beth
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H230198',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Atlas] OKC DEL within 30 days from 3-13-26.  3/29 Warped Black Horizotal Pieces, Electrical Hole, Swim Spa Lifter & Cover Clip Holes, and one panel falling off https://photos.app.goo.gl/KphMBJ5htMTBGZnDA  3/25 - Good to Ship per Mandy.', NULL, 'Lockwood-KS, Sue & Beth', NULL);

-- Tyler: X T15D | H253186 | Sold | Davis, Tina/Brad
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H253186',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Atlas] Delivery Time Frame: 60 days from 2-20-26, Have Rx, PIF', 'atlas', 'Davis, Tina/Brad', 'Need to Print');

-- Tyler: X T19 | H243432 | Sold | Walker, Rick/Linda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H243432',
   'Sterling', 'GRAPH', 'UN', 'X T19',
   '[Atlas] contract says deep, but they indeed want the shallow | [Expo] @Home office', 'atlas', 'Walker, Rick/Linda', 'Need to Print');

-- Tyler: X T21D | H253075 | Sold | Yelverton, Debi Su
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H253075',
   'White', 'GRAPH', 'WR', 'X T21D',
   '[Atlas] Have Rx, Delivery Time Frame: After Alex''s concrete bid. | [Expo] on the floor', NULL, 'Yelverton, Debi Su', 'PIF');

-- Tyler: X Thera 13 | H252381 | Sold | Franklin, Cody/Isabella
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H252381',
   'Sterling', 'GRAPH', 'WR', 'X Thera 13',
   '[Atlas] Have Rx; Delivery Time Frame: 30-45 days from 9-21-25 | [Expo] on the floor', 'atlas', 'Franklin, Cody/Isabella', '$1,102.17 (SPA) + $1,899.79 (CGB)');

-- Tyler: X Thera D | H251878 | Sold | Jarmon, Woody/Diana
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H251878',
   'Sterling', 'GRAPH2', 'UN', 'X Thera D',
   '[Atlas] Need Rx; Deliver Time Frame: Feb 2026. 
Customer lives in Corsicana | [Expo] Was @ State Fair. on the floor', 'atlas', 'Jarmon, Woody/Diana', '25716.01');

-- Tyler: C Bal 6 | 2601656 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2601656',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6',
   '[Expo] @Home office', NULL, NULL, NULL);

-- Tyler: C Bal 7 | 2602259 | Stock | TAKE TO KANSAS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2602259',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   '[Expo] @Home office', NULL, 'TAKE TO KANSAS', NULL);

-- Tyler: C Prec 8 | 2518360 | Stock | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2518360',
   'Sterling', 'DWAL2', 'WR', 'C Prec 8',
   '[Expo] on the floor', NULL, 'Tyler Showroom', NULL);

-- Tyler: CGA Terrain | T240536 | Stock | @Home office, DO NOT SELL - This is the unit Aaron brings to all shows
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'T240536',
   'White', 'TAN', 'UN', 'CGA Terrain',
   '[Atlas] Rat damage. chew marks and there is insulation in the plumbing, per Aaron. 3/25 - New panels, new kit, new filter housing, start up kit, and whatever else Chris finds. | [Expo] This is so damaged and dirty that it should not be displayed at a show. @Home office', NULL, '@Home office, DO NOT SELL - This is the unit Aaron brings to all shows', 'Chris 3-25-26');

-- Tyler: G BarH LE | R250007 | Stock | tyler showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R250007',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Expo] on the floor', NULL, 'tyler showroom', NULL);

-- Tyler: G BarH LE | R250180 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R250180',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Expo] @Home office', NULL, NULL, NULL);

-- Tyler: G Ocho CS | R251788 | Stock | tyler store
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251788',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, 'tyler store', NULL);

-- Tyler: G San Mig | R251522 | Stock | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251522',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   '[Expo] on the floor', NULL, 'Tyler Showroom', NULL);

-- Tyler: G San Mig | R251600 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251600',
   'SeaSalt', 'GRAPH', 'WR', 'G San Mig',
   '[Expo] on the floor', NULL, NULL, NULL);

-- Tyler: LSX 800 | 2406714 | Stock | wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'wet_model', '2406714',
   'Sterling', 'GRAPH', 'UN', 'LSX 800',
   '[Atlas] This is wet model in Tyler | [Expo] on the floor', NULL, 'wet model', NULL);

-- Tyler: LSX 800 | 2500515 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2500515',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Expo] 3-20-26 Light bar has been changed. on the floor', NULL, NULL, NULL);

-- Tyler: LSX 850 | 2603342 | Sold | Not @ tent sale, Ricky Ahlstedt
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603342',
   'Sterling', 'GRAPH', 'WR', 'LSX 850',
   '[Atlas] Sold out FW location. Client at least 30 days out from deliivery as of 4-1-26 | [Expo] @Home office', NULL, 'Not @ tent sale, Ricky Ahlstedt', NULL);

-- Tyler: LSX 900 | 2503035 | Stock | Tyler-Tyler, SALT SYSTEM INSTALLED
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2503035',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   '[Atlas] SALT SYSTEM INSTALLED | [Expo] on the floor', NULL, 'Tyler-Tyler, SALT SYSTEM INSTALLED', NULL);

-- Tyler: SG MP 2 | 25070082 | Stock | backroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '25070082',
   'N/A', 'N/A', 'WR', 'SG MP 2',
   NULL, NULL, 'backroom', NULL);

-- Tyler: SG MP 2 | 230110042 | Stock | Palestine - Lot #2
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '230110042',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   NULL, NULL, 'Palestine - Lot #2', NULL);

-- Tyler: SG MP 2 | 250400004 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '250400004',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- Tyler: SG MP 2 | 25070103 | Sold | Shinalt, Phil
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '25070103',
   NULL, NULL, 'WR', 'SG MP 2',
   '[Expo] 2/18 - Currently at Tyler Home Office', 'atlas', 'Shinalt, Phil', NULL);

-- Tyler: SG MP 3 | 250400110 | Stock | Tyler showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '250400110',
   'N/A', 'N/A', 'WR', 'SG MP 3',
   NULL, NULL, 'Tyler showroom', NULL);

-- Tyler: TS 6.2 | 2516995 | Stock | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2516995',
   'Sterling', 'GRAPH2', 'UN', 'TS 6.2',
   '[Atlas] 2/3/26 - has electrical hole cut into it. Was delivered to a customer''s house for a couple of days, then they upgraded. | [Expo] on the floor', NULL, 'Tyler Showroom', NULL);

-- Tyler: TS 7.2 | 2500531 | Stock | wet model showroom-tyler
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'wet_model', '2500531',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Expo] on the floor', NULL, 'wet model showroom-tyler', NULL);

-- Tyler: TS 7.25 | 2512708 | Stock | SELL AS IS - Corner Damage, SELL AS IS - Corner Damage
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2512708',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.25',
   '[Atlas] Open Cabinet model - Panel is in the back per Eric on 3/25 | [Expo] on the floor', NULL, 'SELL AS IS - Corner Damage, SELL AS IS - Corner Damage', NULL);

-- Tyler: X Ch21D | H260350 | Stock | Tyler Showroom, behind deck
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H260350',
   'White', 'DWAL2', 'WR', 'X Ch21D',
   '[Expo] on the floor', NULL, 'Tyler Showroom, behind deck', NULL);

-- Tyler: X T15 | H243348 | Stock | showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H243348',
   'Sterling', 'GRAPH', 'WR', 'X T15',
   '[Expo] on the floor', NULL, 'showroom', NULL);

-- Tyler: X T15D | H250316 | Stock | wet model-tyler, behind deck
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'wet_model', 'H250316',
   'Sterling', 'GRAPH2', 'UN', 'X T15D',
   '[Atlas] wet model | [Expo] on the floor', NULL, 'wet model-tyler, behind deck', NULL);

-- Tyler: X T19 | H202303 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H202303',
   'Sterling', 'ESP', 'UN', 'X T19',
   '[Atlas] 2/10 Trade In. All plastic parts are faded or have calcium residue. The panels have cover clips installed along with scratches on some of them. There is also a yellow color to knobs underneath the plastic caps. OCM https://photos.app.goo.gl/xA2dSV5ATTBvEv1DA David fixed the crack on the shelf of the tub.', NULL, NULL, NULL);

-- Tyler: X T19D | H171535 | Stock | Put damaged Cocoa Vanish smartop on this unit, per William.  CIN210119-008
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H171535',
   'Sierra', 'ESP', 'UN', 'X T19D',
   '[Atlas] 1-30-25 MK Plumbing was replaced by Scot today. Need 24-48 hours before we can wet test. Orlando to inform when completed. 2/13 - Orlando to hook it up and make sure it is running properly. 2/14 Tub is still Leaking. Water is coming out of Big Diverter on Swim Spa side. Smaller Diverter gasket with internal housing has been swapped. The smaller diverter is free spinning. (video & Photos uploaded) OCM https://photos.app.goo.gl/BdkuAfGg7vvGRHh88    9/30 - Ordered Parts. Sending to Ennis T19D H171535 Warehouse. Order number: P197127 | [Expo] @Home office', NULL, 'Put damaged Cocoa Vanish smartop on this unit, per William.  CIN210119-008', NULL);

-- Tyler: X T19D MAX | H260098 | Stock | Tyler Showroom, behind deck
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H260098',
   'Sterling', 'GRAPH2', 'WR', 'X T19D MAX',
   '[Expo] on the floor', NULL, 'Tyler Showroom, behind deck', NULL);

-- Tyler: X T21D | H252647 | Stock | behind deck
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H252647',
   'White', 'GRAPH', 'UN', 'X T21D',
   '[Expo] This unit had acrylic damage, but was reworked at the factory, prior to shipping to us. on the floor', NULL, 'behind deck', NULL);

-- Tyler: X Thera 15 | H260023 | Stock | Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H260023',
   'Sterling', 'GRAPH', 'WR', 'X Thera 15',
   NULL, NULL, 'Tyler Showroom', NULL);

-- Tyler: LSX 800 | 2500969 | Stock | 4/1/26 - Brought from Waco to Tyler. Need to wet test and see if we can get it fixed.
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2500969',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   '[Atlas] Need to bring back to Tyler to wet test and see if we can get it fixed.', NULL, '4/1/26 - Brought from Waco to Tyler. Need to wet test and see if we can get it fixed.', NULL);

-- Tyler: X T15D | H260115 | Sold | Bailes, Jackie "Jack"
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H260115',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Atlas] Have Rx', 'atlas', 'Bailes, Jackie "Jack"', 'PIF');

-- Tyler: C Bal 7 | 2600791 | Sold | Guidry, Rene/Arthur
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2600791',
   'Sterling', 'DWAL2', 'UN', 'C Bal 7',
   '[Atlas] Have Rx; Fully foundation deal. Customer approved. Trent''s customer. Has stipulations - just drivers license photo.', NULL, 'Guidry, Rene/Arthur', 'Tyler - 12195');

-- Tyler: TS 240X | 2517471 | Sold | Graham, Wilma
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2517471',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   NULL, NULL, 'Graham, Wilma', 'Tyler');

-- Tyler: TS 7.2 | 2603197 | Sold | crow, janice
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2603197',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   NULL, NULL, 'crow, janice', 'Tyler');

-- Tyler: TS 8.2 | 2507520 | Sold | Ahmed*, Sameer
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2507520',
   'Storm', 'MID2', 'UN', 'TS 8.2',
   '[Atlas] 11/13 - Nat texted him, said he should be ready hopefully by the end of the month', NULL, 'Ahmed*, Sameer', 'PIF Tyler');

-- Tyler: TS 8.25 | 2512182 | Sold | Kitchen*, Dru
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2512182',
   'Sterling', 'MID2', 'UN', 'TS 8.25',
   '[Atlas] Need Rx,', NULL, 'Kitchen*, Dru', '14192.17 Tyler');

-- Tyler: X Thera 13 | H253028 | Sold | Leming, Belinda/Thomas
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'H253028',
   'Sterling', 'GRAPH', 'WR', 'X Thera 13',
   '[Atlas] Have Rx; CGB is Paid. Delivery Timeframe: was April 2026 but customer is ready now as of  1/15/26
may have to take down above ground pool', NULL, 'Leming, Belinda/Thomas', '16000 Tyler');

-- Tyler: C Bal 8 | 2603247 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2603247',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: C Bal 6 | 2500343 | Sold | Lewis, Teresa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', '2500343',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6',
   NULL, NULL, 'Lewis, Teresa', 'Tyler');

-- Tyler: C Bal 9 | 2602349 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2602349',
   'Sterling', 'GRAPH', 'UN', 'C Bal 9',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: C Prec 8 | 2601965 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2601965',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: CGA Glacier | T260054 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'T260054',
   'Mist', 'GRAPH', 'UN', 'CGA Glacier',
   '[Atlas] Scratches on side panel, about 1-1.5 ft long. Won''t be able to be completely buffed out. Acrylic scratches fixed ://photos.app.goo.gl/XXyzfpxAbjhesxUF7', NULL, NULL, 'Tyler');

-- Tyler: G Ocho CS | R251787 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251787',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: G San Mig | R251764 | Sold | Hastings, Jeffrey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'allocated', 'stock', 'R251764',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   NULL, NULL, 'Hastings, Jeffrey', 'Tyler');

-- Tyler: LH S7 | 2600387 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2600387',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: LSX 800 | 2419068 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2419068',
   'Midnight', 'MID', 'UN', 'LSX 800',
   NULL, NULL, NULL, 'Tyler');

-- Tyler: LSX 900 | 2409446 | Stock | 4/1/26 - Need to rewet test it, and purge it, run for a bit.
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2409446',
   'Sterling', 'GRAPH', 'UN', 'LSX 900',
   '[Atlas] This tub was delivered to Jason Picchi in Feb 2025. He sold the house and the new owner made a deal and sold it back to us Nov 2025', NULL, '4/1/26 - Need to rewet test it, and purge it, run for a bit.', 'Tyler');

-- Tyler: X T12 | H251458 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H251458',
   'Sterling', 'GRAPH', 'UN', 'X T12',
   '[Atlas] 3/6 OCM Robbing end panel for another customer. 3-31-26 MK-Parts Arrived in Ennis 3-26-26 Truck', NULL, NULL, 'Tyler Warehouse Team');

-- Tyler: X T15D | H250888 | Stock | 4/1/26 - once we get the other 15' out of tyler that they are fixing, we will have David fix this one.  Jason has already been talking to him about it., LEAK
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H250888',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Atlas] Gash in the 2nd step. leaking on the opposite though. No fittings, no pipes, no crack, but coming out of the shell.. per Jason. Somebody threw a strap which caused it. | [Expo] Will need 2 Soft Tread pieces. see if it''s in stock, if so, send w/ chris - send to Jason''s attention,', NULL, '4/1/26 - once we get the other 15'' out of tyler that they are fixing, we will have David fix this one.  Jason has already been talking to him about it., LEAK', 'Tyler Service Techs');

-- Tyler: C Bal 6 | 2517320 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2517320',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: C Bal 8 | 2601215 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2601215',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: C Prec 7 | 2600894 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2600894',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Atlas] upright cover lifter', NULL, NULL, 'Canton - Tyler');

-- Tyler: CGA Glacier | T240022 | Stock | DO NOT SELL UNTIL WE CAN GET THE PART IN FROM MS, DO NOT SELL UNTIL WE CAN GET THE PART IN FROM MS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'T240022',
   'Grey', 'GREY', 'UN', 'CGA Glacier',
   '[Atlas] Ordered Mother board and pump for Chilly Goat T240022 P197780. Order placed with Trent on 1/12/26 order # 0653249 for relay. As of 1-20-26 - Relay is on backorder 
2-7-26 From MS - It looks like the original part had been discontinued by Balboa with no warning. But they have the updated part available. I guess it''s the same part with a 200 mm difference in cord length. Purchasing let me know time to get more of these in is about 4 weeks.', NULL, 'DO NOT SELL UNTIL WE CAN GET THE PART IN FROM MS, DO NOT SELL UNTIL WE CAN GET THE PART IN FROM MS', 'Canton - Tyler');

-- Tyler: G BarH LE | R250301 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R250301',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: G San Mig | R251598 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251598',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: G Ocho CS | R251547 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'R251547',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: LSX 900 | 2602868 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2602868',
   'White', 'GRAPH', 'UN', 'LSX 900',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: LH L6 | 2603536 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2603536',
   'White', 'GRAPH', 'UN', 'LH L6',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: TS 7.2 | 2412831 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2412831',
   'Sterling', 'GRAPH', 'UN', 'TS 7.2',
   '[Atlas] 3/27 - Per Jason, Ozonator was leaking. Plugged it off in Mt Pleasant.', NULL, NULL, 'Canton - Tyler');

-- Tyler: SG MP 3 | 250400080 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '250400080',
   'N/A', 'N/A', 'UN', 'SG MP 3',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: TS 7.2 | 2601910 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2601910',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: TS 8.25 | 2516244 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', '2516244',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Tyler: X T15D | H253181 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Tyler Showroom' LIMIT 1), 'at_location', 'stock', 'H253181',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   NULL, NULL, NULL, 'Canton - Tyler');

-- Waco: C Bal 7 | 2602744 | Sold | Perry, Richard
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2602744',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Atlas] Delivery Time Frame: 3-4 weeks from 2/1/26 | [Expo] Cedar Park, TX', 'fierce', 'Perry, Richard', '8468.8');

-- Waco: C Bal 7 | 2516746 | Sold | Cevallos, Manuel/Valerie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2516746',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   '[Atlas] Requesting April 20th, Have Rx PIF | [Expo] Waco Warehouse', 'fierce', 'Cevallos, Manuel/Valerie', 'Need to Print');

-- Waco: C Bal 8 | 2409959 | Sold | Holt, Donald
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2409959',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   '[Atlas] Have RX; 3/25 - MISSING PACK | [Expo] Waco Showroom', NULL, 'Holt, Donald', 'PIF');

-- Waco: C Bal 8 | 2511184 | Sold | Sanchez, Michelle/Sixto
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2511184',
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Atlas] have rx, Delivery Time Frame: Approx Sept
Live in Kyle, TX | [Expo] Waco Warehouse', 'fierce', 'Sanchez, Michelle/Sixto', '8100.0');

-- Waco: C Bal 9 | 2416802 | Sold | Marquez, Lizeth/Jesus
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2416802',
   'Sterling', 'ESP', 'UN', 'C Bal 9',
   '[Atlas] Customer was told 2-3 weeks for delivery from 1-22-25.  Robert Kennedy sent In-House docs over to customer on 1-22-25. Need RX | [Expo] Waco Warehouse', 'fierce', 'Marquez, Lizeth/Jesus', '15921.76');

-- Waco: C Prec 7 | 2601942 | Sold | Emmerich/Daughtry, Erin/Lauren
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2601942',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Atlas] Have Rx, 3/22- Contingent upon HOA approval - Don''t call yet. | [Expo] Waco Warehouse', 'fierce', 'Emmerich/Daughtry, Erin/Lauren', '8087.17 + 1098.74 CGB');

-- Waco: TS 240X | 2513076 | Sold | Kujawa, Kristopher
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2513076',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   '[Atlas] upgraded from Prec 7 that was delivered in November of 2025
Delivery in Streetman. Just south of Corsicana. Contract says to Remove Prec 7 and drop off TS 240X then, to move in place within a week. | [Expo] Waco Showroom', NULL, 'Kujawa, Kristopher', '1957.17');

-- Waco: TS 7.2 | 2516803 | Sold | Koch/Hawthorne, Elizabeth/Charles
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'blem', '2516803',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Atlas] Delivery Time Frame: November - OTN 30 days out. Adrian moving onto his floor; contract says per Tim Blem on floor model line, Have Rx | [Expo] Waco Showroom', NULL, 'Koch/Hawthorne, Elizabeth/Charles', '11600.0');

-- Waco: TS 7.25 | 2512905 | Sold | MARIA, MORGAN
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2512905',
   'Smoky', 'GRAPH2', 'WR', 'TS 7.25',
   '[Atlas] Have Rx; Delivery Timeframe: customer will call when ready, 2 - 6 weeks from 1-3-26 | [Expo] Waco Showroom', NULL, 'MARIA, MORGAN', '10571.52');

-- Waco: TS 8.2 | 2600506 | Sold | Prescott, Kerry/Vickie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2600506',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Atlas] Delivery Time Frame: ASAP | [Expo] Waco Warehouse', 'fierce', 'Prescott, Kerry/Vickie', 'Need to Print');

-- Waco: X T12 | H253173 | Sold | Castro-Solano, Rebecca/Miguel
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H253173',
   'Sterling', 'DWAL2', 'WR', 'X T12',
   '[Atlas] Ethan''s Deal. Only $6,000 down via greensky. crushed granite. Delivery Timeframe: 4-5 months from 6-13-25.  1/21/26 - Per Ethan, customer is planning on doing a big home improvement loan next month and putting the swim spa with it. Once the loan is approved, he will reach back out to Ethan to proceed. 
Live in Belton | [Expo] Waco Warehouse', 'fierce', 'Castro-Solano, Rebecca/Miguel', 'Need to Print');

-- Waco: X T19D MAX | H251895 | Sold | Wenske, Ann/Roman
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H251895',
   'Sterling', 'GRAPH', 'WR', 'X T19D MAX',
   '[Atlas] Delivery Time Frame: End of June
Shiner, TX
Stacey''s customer. Customer is a couple months away, but we need a unit on hand for them. | [Expo] Waco Warehouse', 'fierce', 'Wenske, Ann/Roman', '31814.17');

-- Waco: X T21D | H251853 | Sold | Curry/Rowley, Landon & Beth
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H251853',
   'White', 'DWAL2', 'UN', 'X T21D',
   '[Atlas] Need Rx | [Expo] Waco Warehouse', 'fierce', 'Curry/Rowley, Landon & Beth', 'PIF');

-- Waco: X Thera 13 | H260091 | Sold | Lewis, Mark/Merry
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H260091',
   'Sterling', 'GRAPH', 'WR', 'X Thera 13',
   '[Atlas] Have Rx; Delivery Timeframe: 2-4 weeks from 3-24-26 | [Expo] Waco Showroom', NULL, 'Lewis, Mark/Merry', '19943.0');

-- Waco: C Bal 8 | 2503816 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2503816',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   '[Atlas] 11-7-25MK Ordered panel via email to MS. 3/25 - Still missing left panel. | [Expo] Waco Warehouse', 'fierce', NULL, NULL);

-- Waco: C Bal 8 | 2601222 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2601222',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   '[Expo] Waco Warehouse', 'fierce', NULL, NULL);

-- Waco: CGA Glacier | T260026 | Stock | Waco Showroom, WET MODEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'T260026',
   'Grey', 'GREY', 'UN', 'CGA Glacier',
   NULL, NULL, 'Waco Showroom, WET MODEL', NULL);

-- Waco: G BarH LE | R240084 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'R240084',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: G BarH LE | R240616 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'R240616',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Expo] Waco Warehouse', 'fierce', NULL, NULL);

-- Waco: G San Mig | R251602 | Stock | Waco showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'R251602',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   NULL, NULL, 'Waco showroom', NULL);

-- Waco: LH 6 | 2412424 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2412424',
   'White', 'GRAPH', 'UN', 'LH 6',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: LH S7 | 2600018 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2600018',
   'White', 'MID', 'WR', 'LH S7',
   '[Expo] Waco Warehouse', 'fierce', NULL, NULL);

-- Waco: LSX 800 | 2602397 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2602397',
   'Sterling', 'MID2', 'WR', 'LSX 800',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: LSX 900 | 2601487 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2601487',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: TS 240X | 2518136 | Stock | BLEM, BLEM
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2518136',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   '[Atlas] Big acrylic chip that goes through to the fiberglass on the left side of the spa (next to lounger) | [Expo] Waco Warehouse', 'fierce', 'BLEM, BLEM', NULL);

-- Waco: TS 7.2 | 2602211 | Stock | Waco Showroom, WET MODEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2602211',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   NULL, NULL, 'Waco Showroom, WET MODEL', NULL);

-- Waco: TS 7.2 | 2602496 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2602496',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Expo] Waco Warehouse', 'fierce', NULL, NULL);

-- Waco: TS 8.2 | 2516631 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2516631',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: TS 8.25 | 2602221 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '2602221',
   'Smoky', 'DWAL2', 'WR', 'TS 8.25',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: X Ch15D | H250506 | Stock | Waco Showroom, WET MODEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'H250506',
   'Sterling', 'GRAPH', 'UN', 'X Ch15D',
   NULL, NULL, 'Waco Showroom, WET MODEL', NULL);

-- Waco: X T12 | H251720 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'H251720',
   'Sterling', 'GRAPH', 'UN', 'X T12',
   '[Expo] Was @ State Fair', NULL, 'Waco Showroom', NULL);

-- Waco: X T21D | H251486 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', 'H251486',
   'White', 'GRAPH', 'UN', 'X T21D',
   NULL, NULL, 'Waco Showroom', NULL);

-- Waco: C Bal 6 | 2601185 | Sold | Garcia, Henry/Margaret
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2601185',
   'Sterling', 'GRAPH', 'WR', 'C Bal 6',
   '[Atlas] Have Rx | [Expo] Waco Warehouse', 'fierce', 'Garcia, Henry/Margaret', 'PIF');

-- Waco: TS 7.2 | 2602500 | Sold | Evans/Krueger, Lyn/John
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2602500',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Atlas] Have Rx | [Expo] Waco Warehouse', 'fierce', 'Evans/Krueger, Lyn/John', 'PIF');

-- Waco: X T15D | H260314 | Sold | Haydon, Tommy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H260314',
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Atlas] Have Rx | [Expo] Waco Warehouse', 'fierce', 'Haydon, Tommy', '28107.17');

-- Waco: X T12 | H253042 | Sold | Skaggs, Jamie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H253042',
   'Sterling', 'GRAPH', 'WR', 'X T12',
   '[Atlas] Customer is ready for delivery per Jonas 3-24-26 | [Expo] Skaggs Trainer12 H253042 Ordered end via email 3-25-26 Waco Warehouse', 'fierce', 'Skaggs, Jamie', 'Need to Print');

-- Waco: C Bal 7 | 2603239 | Sold | Stephenson, Charles "Ken
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2603239',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Atlas] Delivery Time Frame: Within 30 days 
CGB - Dripping Springs | [Expo] Waco Warehouse', 'fierce', 'Stephenson, Charles "Ken', 'Need to Print');

-- Waco: LSX 800 | 2600596 | Sold | Hussey, Scott
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2600596',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Atlas] Delivery Time Frame: 4-5 weeks from 2/17/26 | [Expo] Waco Warehouse', 'fierce', 'Hussey, Scott', 'Need to Print');

-- Waco: LSX 900 | 2603166 | Sold | Franz, Carl
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2603166',
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Atlas] Delivery Timeframe: 2-4 weeks from 2-10-26 ; pending deck install
Alex team doing deck. | [Expo] Waco Warehouse', 'fierce', 'Franz, Carl', 'Need to Print');

-- Waco: TS 7.2 | 2603648 | Sold | Stampley, Jonathan "Michael"
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2603648',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Atlas] Delivery Time Frame: Within 30 days 
San Marcos-ish | [Expo] Waco Warehouse', 'fierce', 'Stampley, Jonathan "Michael"', 'Need to Print');

-- Waco: CGA Terrain | T240161 | Stock | SELL AS IS, SELL AS IS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'blem', 'T240161',
   'White', 'TAN', 'UN', 'CGA Terrain',
   '[Atlas] This was the tub Aaron takes to all the shows in early 2025.
SELL AS IS! 7/30 Soft Tread Damaged 2/3 Acrylic Damage  https://photos.app.goo.gl/iXbioe3cacLahY3N7  4/15 - Not fixing acrylic. Per Tim.', NULL, 'SELL AS IS, SELL AS IS', 'Waco');

-- Waco: SG MP 2 | 250400064 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'at_location', 'stock', '250400064',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   NULL, NULL, NULL, 'Waco');

-- Kansas: C Bal 7 | 2602271 | Sold | Long, Etta
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'allocated', 'stock', '2602271',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   '[Atlas] PIF, In-House', NULL, 'Long, Etta', 'KS');

-- Kansas: C Prec 7 | 2600520 | Sold | Klein, Jeff/Laurena
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'allocated', 'stock', '2600520',
   'Sterling', 'MID', 'UN', 'C Prec 7',
   '[Atlas] Double delivery, PIF', NULL, 'Klein, Jeff/Laurena', 'PIF');

-- Kansas: C Prec 7 | 2601947 | Sold | Pifer, Bonnie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'allocated', 'stock', '2601947',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Atlas] Delivery this week', NULL, 'Pifer, Bonnie', 'PIF');

-- Kansas: TS 7.2 | 2602806 | Sold | Kendale, Deanna
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'allocated', 'stock', '2602806',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   NULL, NULL, 'Kendale, Deanna', 'PIF');

-- Kansas: TS 8.2 | 2602421 | Sold | James, Ron & Rita
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'allocated', 'stock', '2602421',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, 'James, Ron & Rita', 'KS');

-- Kansas: C Prec 8 | 2601572 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', '2601572',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: G Ocho SE | R251275 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', 'R251275',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho SE',
   '[Atlas] Old AH hot tubs', NULL, 'Wichita Showroom', NULL);

-- Kansas: LH S7 | 2602383 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', '2602383',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: LSX 800 | 2517371 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', '2517371',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: TS 7.2 | 2602208 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', '2602208',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: TS 8.2 | 2601922 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', '2601922',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: X T15D | H253187 | Stock | Wichita KS floor model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', 'H253187',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   NULL, NULL, 'Wichita KS floor model', 'KS');

-- Kansas: X T21D | H260051 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', 'H260051',
   'White', 'DWAL2', 'UN', 'X T21D',
   NULL, NULL, 'Wichita Showroom', NULL);

-- Kansas: X Thera 13 | H252816 | Stock | Wichita Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Kansas Showroom' LIMIT 1), 'at_location', 'stock', 'H252816',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   NULL, NULL, 'Wichita Showroom', NULL);

-- OKC: C Bal 6 | 2602246 | Sold | ???
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602246',
   'Sterling', 'GRAPH', 'WR', 'C Bal 6',
   '[Atlas] One of Ryan Frank''s previous customers
Ship w/ Steps & Cover', 'atlas', '???', NULL);

-- OKC: C Bal 7 | 2515089 | Sold | Lee
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2515089',
   'Smoky', 'GRAPH', 'UN', 'C Bal 7',
   NULL, NULL, 'Lee', 'PIF');

-- OKC: C Bal 7 | 2603244 | Sold | Samuel/Tammy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2603244',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Atlas] Delivery Time Frame: 1-3 months from 1-30-26 
Shipping w/cover & steps from MS', NULL, 'Samuel/Tammy', 'PIF');

-- OKC: C Bal 8 | 2604194 | Sold | Lance
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2604194',
   'Sterling', 'MID', 'WR', 'C Bal 8',
   '[Atlas] Taking this to Garden City show to deliver- Customer is close to the event.', NULL, 'Lance', NULL);

-- OKC: C Bal 9 | 2602547 | Sold | Gina
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602547',
   'Sterling', 'GRAPH', 'UN', 'C Bal 9',
   '[Atlas] Delivery Time Frame: Within 30 days from 2-14-26; CRUSHED GRANITE BASE', NULL, 'Gina', 'Spa- PIF, CGB- NOT PAID $1,215.00');

-- OKC: C Bal 9 | 2602551 | Sold | Tracy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602551',
   'Sterling', 'GRAPH', 'WR', 'C Bal 9',
   '[Atlas] Delivery Time Frame: 30 days from 2-28-26
w/ cover & steps', NULL, 'Tracy', NULL);

-- OKC: C Prec 8 | 2602145 | Sold | Shawn
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602145',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Atlas] Delivery Time Frame: 4-6 weeks from 2-28-26
w/ cover & steps | [Expo] End March/April', NULL, 'Shawn', NULL);

-- OKC: C Prec 8 | 2602850 | Sold | Rod/Wendy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602850',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Atlas] Delivery Time Frame: 6-8 weeks frmo 2-15-26', NULL, 'Rod/Wendy', NULL);

-- OKC: G Ocho CS | R260062 | Sold | Saydee
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', 'R260062',
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   '[Atlas] Delivery Time Frame is blank. 
Sending to OKC w/ steps', NULL, 'Saydee', NULL);

-- OKC: TS 8.2 | 2514551 | Sold | Jeremy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2514551',
   'Smoky', 'GRAPH2', 'UN', 'TS 8.2',
   '[Atlas] OKC 30 days from 2/14/26? Building a house. RF will find out an update', NULL, 'Jeremy', NULL);

-- OKC: X T12 | H253174 | Sold | Linda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', 'H253174',
   'Sterling', 'DWAL2', 'UN', 'X T12',
   '[Atlas] One week out for delivery', NULL, 'Linda', NULL);

-- OKC: X T15 | H260628 | Sold | Karen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', 'H260628',
   'Sterling', 'GRAPH', 'WR', 'X T15',
   '[Atlas] Delivery Time Frame: 45 days from 2/19/26, Have Rx', NULL, 'Karen', '16796.5');

-- OKC: X T19D MAX | H253163 | Sold | Robert
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', 'H253163',
   'White', 'GRAPH', 'UN', 'X T19D MAX',
   '[Atlas] Customer is ready in 2-3 weeks- will follow up next week', NULL, 'Robert', '27849.0');

-- OKC: C Bal 6 | 2600329 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2600329',
   'Smoky', 'GRAPH', 'UN', 'C Bal 6',
   NULL, NULL, NULL, NULL);

-- OKC: C Bal 7 | 2600347 | Sold | Erik & Lori
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2600347',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   '[Atlas] Have Rx', NULL, 'Erik & Lori', 'PIF');

-- OKC: C Bal 7 | 2600346 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2600346',
   'Sterling', 'GRAPH', 'UN', 'C Bal 7',
   NULL, NULL, NULL, NULL);

-- OKC: C Bal 8 | 2601393 | Sold | Jacob
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2601393',
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Atlas] Delivery Timeframe: says Sunday; 3-29-26? because the next sunday is Easter
Contract is UNSIGNED', NULL, 'Jacob', 'PIF');

-- OKC: C Bal 9 | 2602552 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2602552',
   'Sterling', 'GRAPH', 'UN', 'C Bal 9',
   NULL, NULL, NULL, NULL);

-- OKC: CGA Glacier | T260209 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'T260209',
   'N/A', 'N/A', 'UN', 'CGA Glacier',
   NULL, NULL, NULL, NULL);

-- OKC: LH L7 | 2601983 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2601983',
   'White', 'GRAPH', 'UN', 'LH L7',
   NULL, NULL, NULL, NULL);

-- OKC: LH S6 | 2602450 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2602450',
   'White', 'GRAPH', 'UN', 'LH S6',
   NULL, NULL, NULL, NULL);

-- OKC: LH S7 | 2603075 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603075',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, NULL, NULL);

-- OKC: LSX 900 | 2603169 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603169',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   NULL, NULL, NULL, NULL);

-- OKC: LSX 900 | 2603164 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603164',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   NULL, NULL, NULL, NULL);

-- OKC: SG MP 2 | 250800007 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '250800007',
   'N/A', 'N/A', 'UN', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- OKC: TS 6.2 | 2602879 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2602879',
   'Sterling', 'GRAPH2', 'UN', 'TS 6.2',
   NULL, NULL, NULL, NULL);

-- OKC: TS 7.2 | 2602886 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'wet_model', '2602886',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Atlas] wet model at the show', NULL, NULL, NULL);

-- OKC: TS 8.25 | 2600403 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2600403',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   NULL, NULL, NULL, NULL);

-- OKC: X T15D | H253105 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'H253105',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   NULL, NULL, NULL, NULL);

-- OKC: X T21D | H253076 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'H253076',
   'White', 'GRAPH', 'UN', 'X T21D',
   NULL, NULL, NULL, NULL);

-- OKC: X Thera 13 | H260149 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'H260149',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   NULL, NULL, NULL, NULL);

-- OKC: C Bal 6 | 2602540 | Sold | Curtis/Belinda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602540',
   'Sterling', 'GRAPH', 'WR', 'C Bal 6',
   '[Atlas] Deliery Time Frame: ASAP 
Shipping w/ cover & steps from MS', NULL, 'Curtis/Belinda', NULL);

-- OKC: C Prec 8 | 2602849 | Sold | Travis/Gerald
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602849',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Atlas] Delivery Timeframe: Asap; ready 2-4 weeks
contract unsigned', NULL, 'Travis/Gerald', NULL);

-- OKC: C Bal 8 | 2517123 | Sold | John
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2517123',
   'Storm', 'GRAPH', 'UN', 'C Bal 8',
   NULL, NULL, 'John', NULL);

-- OKC: X T15D | H260116 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'H260116',
   'Sterling', 'GRAPH2', 'UN', 'X T15D',
   NULL, NULL, NULL, NULL);

-- OKC: X T12 | H252827 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'H252827',
   'Sterling', 'GRAPH', 'WR', 'X T12',
   NULL, NULL, NULL, NULL);

-- OKC: TS 8.25 | 2518272 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2518272',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   NULL, NULL, NULL, NULL);

-- OKC: TS 8.2 | 2602918 | Sold | James/Emily
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602918',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   NULL, NULL, 'James/Emily', 'PIF');

-- OKC: TS 8.2 | 2602420 | Sold | Thad/Casey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602420',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   NULL, NULL, 'Thad/Casey', 'PIF');

-- OKC: TS 7.25 | 2500812 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2500812',
   'Sterling', 'GRAPH', 'UN', 'TS 7.25',
   NULL, NULL, NULL, NULL);

-- OKC: TS 7.2 | 2603377 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603377',
   'Sterling', 'GRAPH', 'WR', 'TS 7.2',
   NULL, NULL, NULL, NULL);

-- OKC: TS 7.2 | 2603650 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603650',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   NULL, NULL, NULL, NULL);

-- OKC: LH L5 | 2604114 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2604114',
   'Sterling', 'GRAPH', 'UN', 'LH L5',
   NULL, NULL, NULL, NULL);

-- OKC: G San Mig | R251715 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', 'R251715',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   NULL, NULL, NULL, NULL);

-- OKC: G Ocho CS | R260019 | Sold | Derrick/Amanda
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', 'R260019',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, 'Derrick/Amanda', 'PIF');

-- OKC: C Prec 8 | 2602847 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2602847',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   NULL, NULL, NULL, NULL);

-- OKC: C Prec 8 | 2602851 | Sold | Riley
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602851',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   NULL, NULL, 'Riley', 'PIF');

-- OKC: C Prec 7 | 2603035 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603035',
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   NULL, NULL, NULL, NULL);

-- OKC: C Prec 7 | 2603043 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603043',
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   NULL, NULL, NULL, NULL);

-- OKC: C Bal 8 | 2601394 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2601394',
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   NULL, NULL, NULL, NULL);

-- OKC: TS 240X | 2603179 | Sold | Tim
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2603179',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   NULL, NULL, 'Tim', NULL);

-- OKC: LSX 800 | 2517368 | Sold | Joanna
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2517368',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   NULL, NULL, 'Joanna', 'PIF');

-- OKC: LH S7 | 2603067 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'at_location', 'stock', '2603067',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, NULL, NULL);

-- OKC: C Bal 6 | 2602247 | Sold | Daniel/Vanita
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602247',
   'Sterling', 'GRAPH', 'WR', 'C Bal 6',
   '[Atlas] FOUNDATION', 'atlas', 'Daniel/Vanita', NULL);

-- OKC: TS 8.2 | 2602919 | Sold | Bobby/Janey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602919',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Atlas] Delivery Time Frame: 1 month from 3/11/26
Sending to OKC w/ steps', NULL, 'Bobby/Janey', NULL);

-- OKC: TS 8.2 | 2602916 | Sold | Mark
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602916',
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Atlas] Delivery TIme Frame: 6-8 weeks from 2-28-26, but as of 3/11 - customer is ready. 
Shipping w/cover & steps from MS', NULL, 'Mark', NULL);

-- OKC: TS 7.25 | 2602702 | Sold | Kenny/Sue
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602702',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.25',
   '[Atlas] Delivery Timeframe: 3 weeks from 3-15-26; customer will call', NULL, 'Kenny/Sue', NULL);

-- OKC: LSX 800 | 2600747 | Sold | Curtis/Cheri
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2600747',
   'Sterling', 'GRAPH2', 'WR', 'LSX 800',
   '[Atlas] Delivery Time Frame: 2-3 weeks from 3/11/26 per Ryan . Shipping w/cover & steps from MS', NULL, 'Curtis/Cheri', NULL);

-- OKC: C Prec 7 | 2602837 | Sold | Jason
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2602837',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Atlas] Delivery time: 2-4 weeks', NULL, 'Jason', NULL);

-- OKC: C Bal 7 | 2603789 | Sold | Melissia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'OKC Showroom' LIMIT 1), 'allocated', 'stock', '2603789',
   'Sterling', 'DWAL2', 'WR', 'C Bal 7',
   '[Atlas] Customer will be ready for delivery 2-3 weeks from 3-19-26 according to Fierce', NULL, 'Melissia', NULL);

-- Georgetown: C Bal 8 | 2507090 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2507090',
   'Sterling', 'GRAPH', 'UN', 'C Bal 8',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: C Bal 9 | 2503394 | Stock | showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2503394',
   'Sterling', 'DWAL2', 'UN', 'C Bal 9',
   NULL, NULL, 'showroom', NULL);

-- Georgetown: C Prec 7 | 2507459 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2507459',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: C Prec 8 | 2500670 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2500670',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: CGA Glacier | T240913 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'T240913',
   'Grey', 'GREY', 'UN', 'CGA Glacier',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: G BarH LE | R250455 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'R250455',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: G San Mig | R250807 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'R250807',
   'SeaSalt', 'GRAPH', 'UN', 'G San Mig',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: LSX 900 | 2507494 | Stock | SALT SYSTEM INSTALLED
showroom, SALT SYSTEM INSTALLED
showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2507494',
   'Sterling', 'GRAPH', 'UN', 'LSX 900',
   NULL, NULL, 'SALT SYSTEM INSTALLED
showroom, SALT SYSTEM INSTALLED
showroom', NULL);

-- Georgetown: LSX 900 | 2507995 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2507995',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: TS 7.2 | 2508216 | Stock | showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2508216',
   'Sterling', 'DWAL2', 'UN', 'TS 7.2',
   NULL, NULL, 'showroom', NULL);

-- Georgetown: TS 7.2 | 2507240 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2507240',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: TS 8.25 | 2506434 | Stock | showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', '2506434',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   NULL, NULL, 'showroom', NULL);

-- Georgetown: X T12 | H250794 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'H250794',
   'Sterling', 'GRAPH', 'UN', 'X T12',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: X T15D | H250955 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'H250955',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: X Thera 13 | H250861 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'H250861',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   '[Expo] Backroom', NULL, NULL, NULL);

-- Georgetown: LH L6 | 2600919 | Sold | McCollough/Arreola, Marti/Julie Anne
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'allocated', 'stock', '2600919',
   'White', 'GRAPH', 'UN', 'LH L6',
   NULL, NULL, 'McCollough/Arreola, Marti/Julie Anne', NULL);

-- Georgetown: X Thera 13 | H251363 | Sold | Schultz, Annette
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'allocated', 'stock', 'H251363',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   '[Atlas] Need Rx | [Expo] Backroom', NULL, 'Schultz, Annette', NULL);

-- Georgetown: SG MP 3 | 250400104 | Sold | Fisher, John/Lisa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'allocated', 'stock', '250400104',
   'N/A', 'N/A', 'WR', 'SG MP 3',
   '[Atlas] DO NOT SEE ANY DEPOSIT -they will pay this when we deliver | [Expo] Backroom', NULL, 'Fisher, John/Lisa', '1920-02-18 12:14:24');

-- Georgetown: G BarH LE | R241707 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Georgetown Showroom' LIMIT 1), 'at_location', 'stock', 'R241707',
   'SeaSalt', 'GRAPH', 'UN', 'G BarH LE',
   '[Atlas] 4/1/26 - Need to confirm SN | [Expo] *Possibly in Georgetown.  There is a Bar Harbor in Georgetown that is missing the sticker..', NULL, NULL, NULL);

-- Plano: TS 8.2 | 2502996 | Sold | Ames, Kevin/Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'allocated', 'stock', '2502996',
   'Sterling', 'GRAPH2', 'UN', 'TS 8.2',
   '[Atlas] Have RX. Customer is doing a project. Must be this one because it is not salt ready.', NULL, 'Ames, Kevin/Michelle', '11217.17');

-- Plano: C Bal 7 | 2601749 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2601749',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   NULL, NULL, NULL, NULL);

-- Plano: C Prec 8 | 2601305 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2601305',
   'Storm', 'MID', 'WR', 'C Prec 8',
   NULL, NULL, NULL, NULL);

-- Plano: CGA Glacier | T230157 | Stock | wet model, wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', 'T230157',
   'Sterling', 'GREY', 'UN', 'CGA Glacier',
   NULL, NULL, 'wet model, wet model', NULL);

-- Plano: G Ocho SE | R230807 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', 'R230807',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho SE',
   '[Fierce] Was a wet model, now a dry model.', NULL, NULL, NULL);

-- Plano: LSX 800 | 2418736 | Stock | wet model, wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', '2418736',
   'Sterling', 'GRAPH', 'UN', 'LSX 800',
   '[Fierce] has upright lifter installed', NULL, 'wet model, wet model', NULL);

-- Plano: LSX 900 | 2503036 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2503036',
   'Sterling', 'MID2', 'UN', 'LSX 900',
   NULL, NULL, NULL, NULL);

-- Plano: SG MP 2 | 240200008 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '240200008',
   NULL, NULL, 'UN', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- Plano: SG MP 3C | 240400015 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '240400015',
   NULL, NULL, 'UN', 'SG MP 3C',
   NULL, NULL, NULL, NULL);

-- Plano: TS 240X | 2503243 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2503243',
   'Sterling', 'DWAL2', 'UN', 'TS 240X',
   NULL, NULL, NULL, NULL);

-- Plano: TS 7.2 | 2601054 | Stock | wet model, wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', '2601054',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   NULL, NULL, 'wet model, wet model', NULL);

-- Plano: TS 8.25 | 2502281 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2502281',
   'Midnight', 'MID2', 'UN', 'TS 8.25',
   NULL, NULL, NULL, NULL);

-- Plano: X Ch21D | H250356 | Stock | wet model, wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', 'H250356',
   'White', 'GRAPH', 'UN', 'X Ch21D',
   '[Fierce] roll cover installed', NULL, 'wet model, wet model', NULL);

-- Plano: X T15D | H250069 | Stock | wet model, wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'wet_model', 'H250069',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Fierce] has upright lifter installed on one side, vanish lifter on other side', NULL, 'wet model, wet model', NULL);

-- Plano: X Thera 13 | H250777 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', 'H250777',
   'Sterling', 'GRAPH', 'UN', 'X Thera 13',
   NULL, NULL, NULL, NULL);

-- Plano: C Bal 6 CS | 2601654 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2601654',
   'Smoky', 'DWAL2', 'WR', 'C Bal 6 CS',
   NULL, NULL, NULL, NULL);

-- Plano: LH S7 | 2600985 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Plano Showroom' LIMIT 1), 'at_location', 'stock', '2600985',
   'White', 'GRAPH', 'UN', 'LH S7',
   NULL, NULL, NULL, NULL);

-- Houston: C Bal 6 CS | 2517995 | Sold | Viator, Becky/Derik
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2517995',
   'Sterling', 'GRAPH', 'UN', 'C Bal 6 CS',
   '[Atlas] Need RxCustomer confirmed with Nikki on 1/23 that he will pay with a check on Delivery. We still have to see if he will be getting a prescription or not. Need Rx', 'houston_aaron', 'Viator, Becky/Derik', '8864.16');

-- Houston: C Bal 7 | 2602936 | Sold | Giles-HOUDEL, Carl/Carole
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2602936',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Atlas] Sent w/ cover & steps from MS', 'houston_aaron', 'Giles-HOUDEL, Carl/Carole', 'Need to Print');

-- Houston: C Bal 7 | 2602948 | Sold | Leger- HOUDEL, Jonathan
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2602948',
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Atlas] Deliver Time Frame: 2-4 weeks from 2/28/26
shipping w/ cover & steps from MS', 'houston_aaron', 'Leger- HOUDEL, Jonathan', 'Need to Print');

-- Houston: C Bal 8 | 2602066 | Sold | Gray-HOUDEL, Dennis/Lisa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2602066',
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Atlas] Delivery Time Frame: 30-60 days from 2/14/26
Sending to Houston w/ cover & steps from MS
Lifters? Have Rx', 'houston_aaron', 'Gray-HOUDEL, Dennis/Lisa', 'Need to Print');

-- Houston: C Prec 8 | 2602141 | Sold | Cruz-HOUDEL, Jose
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2602141',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Atlas] Delivery Time Frame: 3-6 weeks from 3/1/26
Sending to Houston w/ cover & steps from MS, Have Rx', 'houston_aaron', 'Cruz-HOUDEL, Jose', '2795.0');

-- Houston: CGA Glacier | T260233 | Sold | Kutzenberger-HOUDEL, Kyle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', 'T260233',
   'Grey', 'GRAPH', 'WR', 'CGA Glacier',
   '[Atlas] Sending to Houston w/ cover from MS, Have Rx', NULL, 'Kutzenberger-HOUDEL, Kyle', 'PIF');

-- Houston: LH 6 | 2508962 | Sold | Wilson-HOUDEL, Jay
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2508962',
   'Mist', 'MID', 'WR', 'LH 6',
   '[Atlas] Delivery Time Frame: 4-6 weeks from 10-3-26
no lifter; just steps and chemicals | [Expo] SHIP - UP, DOWN, & CAL', 'houston_aaron', 'Wilson-HOUDEL, Jay', '5053.5');

-- Houston: TS 7.2 | 2602205 | Sold | Walker, Joseph & Kimberly
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', '2602205',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Atlas] Delivery Time Frame: within 3 weeks from 3-15-26 
contract is unsigned, Have Rx', NULL, 'Walker, Joseph & Kimberly', 'PIF');

-- Houston: X T15D | H253118 | Sold | Rodriguez/Zuniga-HOUDEL, Adrian/Elieter
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', 'H253118',
   'White', 'GRAPH', 'WR', 'X T15D',
   '[Atlas] Need to see if this is done. Delivery Time Frame: ASAP, Have Rx In-House', NULL, 'Rodriguez/Zuniga-HOUDEL, Adrian/Elieter', 'PIF');

-- Houston: X Thera 13 | H252960 | Sold | Romero - HOU DEL, Timothy/Vickie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', 'H252960',
   'Sterling', 'GRAPH', 'WR', 'X Thera 13',
   '[Atlas] need 2 vanish lifters for customers, Have Rx', NULL, 'Romero - HOU DEL, Timothy/Vickie', 'PIF');

-- Houston: C Prec 8 | W339269 | Sold | Maness-McKenney-HOU, Karen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Houston Showroom' LIMIT 1), 'allocated', 'stock', 'W339269',
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Atlas] Delivery Time Frame: 30 days. from 2/14/26
Sending to Houston w/ cover & steps from MS
Lifters?Have Rx | [Expo] Sent Email to Houston on 3/5', 'houston_aaron', 'Maness-McKenney-HOU, Karen', '2026-04-06 00:00:00');

-- FTW: C Bal 9 | 2500243 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2500243',
   'Sterling', 'GRAPH', 'UN', 'C Bal 9',
   NULL, NULL, NULL, NULL);

-- FTW: C Prec 7 | 2515964 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2515964',
   'Sterling', 'GRAPH', 'UN', 'C Prec 7',
   NULL, NULL, NULL, NULL);

-- FTW: C Prec 8 | 2516385 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2516385',
   'Sterling', 'GRAPH', 'UN', 'C Prec 8',
   NULL, NULL, NULL, NULL);

-- FTW: CGA Terrain | T240249 | Stock | wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', 'T240249',
   'White', 'TAN', 'UN', 'CGA Terrain',
   NULL, NULL, 'wet model', NULL);

-- FTW: G Ocho CS | R251342 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', 'R251342',
   'SeaSalt', 'GRAPH', 'UN', 'G Ocho CS',
   NULL, NULL, NULL, NULL);

-- FTW: LH L7 | 2600042 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2600042',
   'White', 'GRAPH', 'WR', 'LH L7',
   NULL, NULL, NULL, NULL);

-- FTW: LH S6 | 2600656 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2600656',
   'White', 'GRAPH', 'UN', 'LH S6',
   NULL, NULL, NULL, NULL);

-- FTW: LSX 800 | 2503566 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2503566',
   'Sterling', 'GRAPH2', 'UN', 'LSX 800',
   '[Expo] RECALL - lights were replaced', NULL, NULL, NULL);

-- FTW: LSX 900 | 2501986 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2501986',
   'Sterling', 'GRAPH2', 'UN', 'LSX 900',
   '[Expo] RECALL - lights were replaced', NULL, NULL, NULL);

-- FTW: SG MP 2 | 240200011 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '240200011',
   NULL, NULL, 'UN', 'SG MP 2',
   NULL, NULL, NULL, NULL);

-- FTW: SG MP 3C | 240400024 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '240400024',
   NULL, NULL, 'UN', 'SG MP 3C',
   '[Fierce] this sweaty goat is plugged in to see lights', NULL, NULL, NULL);

-- FTW: TS 240X | 2503965 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2503965',
   'Sterling', 'GRAPH2', 'UN', 'TS 240X',
   '[Fierce] funky corner panel was taken for customer need replacement | [Atlas] Megan said this corner panel has arrived in Ennis | [Expo] RECALL - lights were replaced', NULL, NULL, NULL);

-- FTW: TS 7.2 | 2505489 | Stock | Salt Spa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2505489',
   'Sterling', 'GRAPH2', 'UN', 'TS 7.2',
   '[Fierce] slight acrylic damage on front side edge near controls. Also, seal for smart cell inside is looking interesting. 

https://photos.app.goo.gl/aR1dDKpa6qSwr9pm8 | [Atlas] slight acrylic damage on front side edge near controls. Also, seal for smart cell inside is looking interesting. 

https://photos.app.goo.gl/aR1dDKpa6qSwr9pm8', NULL, 'Salt Spa', NULL);

-- FTW: TS 7.25 | 2407405 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2407405',
   'Midnight', 'GRAPH', 'UN', 'TS 7.25',
   '[Fierce] old mold', NULL, NULL, NULL);

-- FTW: TS 8.2 | 2503521 | Stock | Salt Spa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2503521',
   'Midnight', 'MID2', 'UN', 'TS 8.2',
   '[Expo] RECALL - lights were replaced', NULL, 'Salt Spa', NULL);

-- FTW: TS 8.25 | 2517015 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', '2517015',
   'Smoky', 'MID', 'UN', 'TS 8.25',
   NULL, NULL, NULL, NULL);

-- FTW: X T15D | H252853 | Stock | wet model
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Fort Worth Showroom' LIMIT 1), 'at_location', 'stock', 'H252853',
   'Sterling', 'GRAPH', 'UN', 'X T15D',
   '[Fierce] is there a roll cover installed on this unit? | [Atlas] Has E2E installed on it. Note for Nat: "P.O. Magenta"', NULL, 'wet model', NULL);

-- Factory: C Prec 7 | 2603411 | Pending | Fort Worth Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2603411',
   'Storm', 'MID2', 'WR', 'C Prec 7',
   '[Expo] COMPLETED', 'atlas', 'Fort Worth Showroom', '2026-02-26 00:00:00');

-- Factory: C Prec 8 | 2603049 | Pending | Fort Worth Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2603049',
   'Sterling', 'DWAL2', 'WR', 'C Prec 8',
   '[Expo] COMPLETED', 'atlas', 'Fort Worth Showroom', '2026-02-26 00:00:00');

-- Factory: LSX 900 | 2603606 | Pending | Fort Worth Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2603606',
   'Sterling', 'MID', 'WR', 'LSX 900',
   '[Expo] COMPLETED', 'atlas', 'Fort Worth Showroom', '2026-03-02 00:00:00');

-- Factory: C Bal 8 | 2605264 | Sold | Pana, Nimfa
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605264',
   'Smoky', 'MID', 'WR', 'C Bal 8',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Timeframe was left blank. Ross''s deal. | [Expo] COMPLETED', 'atlas', 'Pana, Nimfa', '2026-04-06 00:00:00');

-- Factory: C Prec 7 | 2603707 | Sold | Unthank***, Kim
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2603707',
   'Sterling', 'DWAL2', 'WR', 'C Prec 7',
   '[Fierce] Aaron Delivery
NOT READY, As of 4-7-25 customer stated she wants a call back at the end of may. nat- 5/23 won''t be ready until as early as MID JULY 7/23 not ready still 8/22- prop not sold yet NOT READY | [Atlas] Need Rx; Updated Delivery Timeframe: End of April ''25 | [Expo] Tuesday Truck 3/31', NULL, 'Unthank***, Kim', '2026-03-05 00:00:00');

-- Factory: C Prec 8 | 2605336 | Sold | Freudigor-OKC, David
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605336',
   'Midnight', 'MID', 'WR', 'C Prec 8',
   '[Fierce] Add to Tulsa Allocation Truck | [Atlas] Delivery Time Frame: ASAP

acrylic was messed up on this, so factory is making another one for us; Nikki put in new correct serial number | [Expo] COMPLETED', 'atlas', 'Freudigor-OKC, David', 'PIF');

-- Factory: C Prec 8 | 2605169 | Sold | Lindell-OKC, Scott
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605169',
   'Smoky', 'DWAL2', 'WR', 'C Prec 8',
   '[Fierce] OKC Delivery | [Atlas] Delivery Time Frame: New Order | [Expo] COMPLETED', 'atlas', 'Lindell-OKC, Scott', '2026-04-10 00:00:00');

-- Factory: C Prec 8 | 2605168 | Sold | Wells-OKC, Kelly
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605168',
   'Smoky', 'DWAL2', 'WR', 'C Prec 8',
   '[Fierce] OKC Delivery | [Atlas] Delivery Time Frame: End of April | [Expo] COMPLETED', 'atlas', 'Wells-OKC, Kelly', '2026-04-16 00:00:00');

-- Factory: G BarH SE | R260557 | Sold | Shepherd, James/Deborah
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'R260557',
   'SeaSalt', 'GRAPH', 'WR', 'G BarH SE',
   '[Fierce] Atlas to Deliver - Terri has been in contact and told them unit won''t start production for another couple of weeks as of 3-16-26 | [Expo] As soon as it completes
COMPLETED', 'atlas', 'Shepherd, James/Deborah', '2026-03-19 00:00:00');

-- Factory: G BarH SE | R260592 | Sold | Hernandez, Keith
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'R260592',
   'SeaSalt', 'GRAPH', 'WR', 'G BarH SE',
   '[Fierce] Atlas to Deliver | [Atlas] LA DEL, NO RX!
Delivery Timeframe: April', 'atlas', 'Hernandez, Keith', '2026-04-16 00:00:00');

-- Factory: LSX 700 | 2605192 | Sold | Triplett/Smith, Randy/Vicki
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605192',
   'Sterling', 'DWAL2', 'WR', 'LSX 700',
   '[Fierce] Aaron to Deliver | [Atlas] Delivery Time Frame: ASAP | [Expo] As soon as it completes', NULL, 'Triplett/Smith, Randy/Vicki', '2025-11-12 00:00:00');

-- Factory: LSX 850 | 2605515 | Sold | Lynch/Searls*, Jeffrey/Tosha
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605515',
   'Sterling', 'GRAPH2', 'WR', 'LSX 850',
   '[Fierce] LM 3-2-26 LM 3-3-26 He called back and let us know to give him a ck bk the last week of may | [Atlas] Delivery Timeframe Update: Check back last week of May. Must have 2026 model! | [Expo] Need to tell Fierce I reordered this.', 'fierce', 'Lynch/Searls*, Jeffrey/Tosha', '2026-04-30 00:00:00');

-- Factory: LSX 900 | 2604522 | Sold | Coffey, Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2604522',
   'Sterling', 'DWAL2', 'WR', 'LSX 900',
   '[Fierce] Aaron Delivery | [Atlas] Delivery Time Frame: 90 days from 1-31-26 | [Expo] April/May
COMPLETED', 'atlas', 'Coffey, Michelle', '2026-03-18 00:00:00');

-- Factory: LSX 900 | 2604786 | Sold | Ort, Jeffrey/Stephanie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2604786',
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Fierce] Fierce Delivery | [Atlas] Have Rx, Delivery Time Frame: 3-4 months, but could be sooner.  So Nat went ahead and ordered since it is a Salt system. | [Expo] COMPLETED', 'fierce', 'Ort, Jeffrey/Stephanie', '3/31/2026, $14,931.17');

-- Factory: TS 67.25 | 2605992 | Sold | Boller, Paul
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605992',
   'Smoky', 'DWAL2', 'WR', 'TS 67.25',
   '[Fierce] Aaron Delivery Customer lives in Georgetown | [Atlas] Delivery Timeframe: 6-8 weeks from 3-17-26', NULL, 'Boller, Paul', '2026-03-20 00:00:00');

-- Factory: TS 7.2 | 2605788 | Sold | Pfister, Sophia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605788',
   'Midnight', 'DWAL2', 'WR', 'TS 7.2',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Time Frame: Approx May. Wants CGB from Fierce directly, Have Rx | [Expo] May', 'fierce', 'Pfister, Sophia', '2026-04-16 00:00:00');

-- Factory: TS 7.25 | 2517574 | Sold | Dearing - MT DEL, Casey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2517574',
   'Smoky', 'DWAL2', 'WR', 'TS 7.25',
   '[Fierce] Montana delivery with Hot tub & swim spa sale- is this getting delivered to Montana? (see address on delivery site page) | [Atlas] Need RX, Do not see this uploaded on drive. 
Delivery Time Frame: Sept. 3/20 - Nat left VM. Montana dealer will be there next week, but chances are, they won''t have this unit on their truck as the customer didn''t answer and they had to turn in their allocation.', 'atlas', 'Dearing - MT DEL, Casey', '12512.86');

-- Factory: TS 7.25 | 2605890 | Sold | Averitte, Mark/Patricia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605890',
   'Smoky', 'GRAPH2', 'WR', 'TS 7.25',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Time Frame: May - As soon as it completes, Have Rx | [Expo] May - As soon as it completes', 'fierce', 'Averitte, Mark/Patricia', '2026-04-16 00:00:00');

-- Factory: TS 8.2 | 2606000 | Sold | Shlager, David/Deb
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606000',
   'Sterling', 'DWAL2', 'WR', 'TS 8.2',
   '[Fierce] Atlas to Deliver | [Atlas] Mark collected payment, and changed delivery time frame to mid april.. | [Expo] As soon as it completes', 'atlas', 'Shlager, David/Deb', '2026-01-28 00:00:00');

-- Factory: TS 8.25 | 2605900 | Sold | Reida-KS, Chad
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605900',
   'Sterling', 'DWAL2', 'WR', 'TS 8.25',
   '[Fierce] KS DEL | [Atlas] Delivery Time Frame: 6-8 weeks from 3-11-26 | [Expo] KS DEL', NULL, 'Reida-KS, Chad', '2026-03-20 00:00:00');

-- Factory: X Ch19D MAX | H260760 | Sold | Pettyjohn - OKC, Darla
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260760',
   'Sterling', 'DWAL2', 'WR', 'X Ch19D MAX',
   '[Fierce] OKC Delivery | [Atlas] ??? | [Expo] As soon as it''s available. COMPLETED', 'atlas', 'Pettyjohn - OKC, Darla', '2026-03-19 00:00:00');

-- Factory: X Mom | H260805 | Sold | Hesson - SWAP, Shawn
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260805',
   'Sterling', 'GRAPH', 'WR', 'X Mom',
   '[Fierce] Fierce SWAP | [Atlas] Customer is in Japan at beginning of April, is hoping for a Mid April swap date. We will need to bring out this cover and take back his old cover along with the old swim spa.  Nat''s Note: Need to find out if we are sending old unit back or taking to the dump. | [Expo] COMPLETED', 'fierce', 'Hesson - SWAP, Shawn', '2026-04-01 00:00:00');

-- Factory: X Thera 13 | H260696 | Sold | Miller, Ron/Pauline
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260696',
   'Sterling', 'DWAL2', 'WR', 'X Thera 13',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Time Frame: 60 days from 2-20-26 | [Expo] COMPLETED', 'fierce', 'Miller, Ron/Pauline', '2026-04-02 00:00:00');

-- Factory: X Thera 15 | H260711 | Sold | Purper, Kimberlee/Jeffrey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260711',
   'Sterling', 'GRAPH', 'WR', 'X Thera 15',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: April/ASAP, PIF, Have Rx | [Expo] As soon as it completes
started 3-24-26', 'atlas', 'Purper, Kimberlee/Jeffrey', '2026-04-01 00:00:00');

-- Factory: X Thera 15 | H260631 | Sold | Contreras, Genoveva
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260631',
   'Sterling', 'GRAPH', 'WR', 'X Thera 15',
   '[Fierce] Aaron Delivery | [Atlas] Delivery Time Frame: 6-8 weeks from 3/23/26
CGB in San Antonio | [Expo] COMPLETED', 'atlas', 'Contreras, Genoveva', '2026-03-24 00:00:00');

-- Factory: C Bal 6 CS | 2517315 | Stock | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2517315',
   'Smoky', 'GRAPH', 'WR', 'C Bal 6 CS',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'Waco Showroom', NULL);

-- Factory: C Bal 7 | 2605920 | Stock | Emma Kirker
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605920',
   'Sterling', 'DWAL2', 'WR', 'C Bal 7',
   '[Fierce] STOCK', NULL, 'Emma Kirker', '2026-04-06 00:00:00');

-- Factory: C Prec 7 | 2600884 | Sold | John/Lauren Thompson, James/Gwendolyn Wisdom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2600884',
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Timeframe: 3-5 weeks from 3-24-26; Alex doing concrete and pergola
Nikki confirmed with Alex, skirting color is graphite', 'atlas', 'John/Lauren Thompson, James/Gwendolyn Wisdom', '2026-06-01 00:00:00');

-- Factory: C Prec 7 | 2603410 | Stock | Kim Unthank****
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2603410',
   'Sterling', 'DWAL2', 'WR', 'C Prec 7',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'Kim Unthank****', NULL);

-- Factory: C Prec 8 | 2601563 | Stock | FTW Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2601563',
   'Sterling', 'MID', 'WR', 'C Prec 8',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'FTW Showroom', NULL);

-- Factory: LSX 700 | 2604704 | Sold | Carter/Allard-OKC, Curtis/Cheri
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2604704',
   'Sterling', 'GRAPH', 'WR', 'LSX 700',
   '[Fierce] STOCK | [Atlas] May be shipping w/cover & steps from MS, need to confirm w/ B before it ships | [Expo] COMPLETED', 'atlas', 'Carter/Allard-OKC, Curtis/Cheri', '2026-02-25 00:00:00');

-- Factory: LSX 700 | 2605194 | Stock | Barbara/Ralph Slater
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2605194',
   'Sterling', 'GRAPH2', 'WR', 'LSX 700',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'Barbara/Ralph Slater', '2026-04-23 00:00:00');

-- Factory: TS 7.2 | W339286 | Stock | Richard Harris-HOUDEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'W339286',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Richard Harris did a charge back on his check.. so we will probably cancel this out. | [Atlas] This was ordered w/ cover & steps from MS', NULL, 'Richard Harris-HOUDEL', '2026-04-07 00:00:00');

-- Factory: TS 7.2 | 2514947 | Stock | Plano Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2514947',
   'Tuscan', 'DWAL2', 'WR', 'TS 7.2',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'Plano Showroom', NULL);

-- Factory: TS 7.2 | 2517779 | Stock | Georgetown Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2517779',
   'Smoky', 'GRAPH', 'WR', 'TS 7.2',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'Georgetown Showroom', NULL);

-- Factory: X Ch19D MAX | H260691 | Stock | FTW Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260691',
   'Sterling', 'GRAPH', 'WR', 'X Ch19D MAX',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', 'FTW Showroom', NULL);

-- Factory: X Ch21D | H260282 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260282',
   'White', 'GRAPH2', 'WR', 'X Ch21D',
   '[Expo] COMPLETED', 'atlas', NULL, NULL);

-- Factory: X T12 | H260232 | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', 'H260232',
   'Sterling', 'GRAPH', 'WR', 'X T12',
   '[Fierce] STOCK | [Expo] COMPLETED', 'atlas', NULL, NULL);

-- Factory: C Prec 8 | 2606186 | Sold | Long-OKC, David
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606186',
   'Smoky', 'MID', 'WR', 'C Prec 8',
   '[Fierce] OKC Delivery. | [Atlas] Delivery TIme Frame: 6-8 weeks from 3-20-26
w/ cover & steps | [Expo] sched to start production 4/14', NULL, 'Long-OKC, David', '2026-02-05 00:00:00');

-- Factory: TS 8.25 | 2606093 | Sold | Scalora, Michael/Cheryl
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606093',
   'Sterling', 'DWAL2', 'WR', 'TS 8.25',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: Mid May - building a home.', 'atlas', 'Scalora, Michael/Cheryl', '2026-04-17 00:00:00');

-- Factory: TS 7.2 | 2606074 | Stock | Nereida Perez
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606074',
   'Sterling', 'DWAL2', 'WR', 'TS 7.2',
   '[Fierce] STOCK', NULL, 'Nereida Perez', '2026-04-24 00:00:00');

-- Factory: LSX 850 | 2606058 | Sold | Stepan, Phil/Julie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606058',
   'Sterling', 'GRAPH2', 'WR', 'LSX 850',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: End of May, have Rx | [Expo] End May', 'atlas', 'Stepan, Phil/Julie', '2026-05-01 00:00:00');

-- Factory: LSX 850 | 2606057 | Sold | Braegelmann, Jim/Angie
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'in_factory', 'stock', '2606057',
   'Sterling', 'GRAPH2', 'WR', 'LSX 850',
   '[Fierce] Aaron Delivery | [Atlas] Delivery Time Frame: April', NULL, 'Braegelmann, Jim/Angie', '2026-02-10 00:00:00');

-- Spas On Order: C Bal 7 | no-serial | Pending | Fort Worth Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   NULL, NULL, 'Fort Worth Showroom', NULL);

-- Spas On Order: C Bal 7 | no-serial | Pending | Tyler Showroom, Tyler Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'MID', 'WR', 'C Bal 7',
   NULL, NULL, 'Tyler Showroom, Tyler Showroom', NULL);

-- Spas On Order: CGA Terrain | no-serial | Pending | Plano Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'TAN', 'WR', 'CGA Terrain',
   NULL, NULL, 'Plano Showroom', NULL);

-- Spas On Order: LH L7 | no-serial | Pending | Tyler showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH L7',
   '[Fierce] Need 2026 Models | [Expo] Next Truck', NULL, 'Tyler showroom', NULL);

-- Spas On Order: LH L7 | no-serial | Pending | Georgetown Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH L7',
   NULL, NULL, 'Georgetown Showroom', NULL);

-- Spas On Order: TS 240X | no-serial | Pending | Georgetown Showroom, Georgetown Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   NULL, NULL, 'Georgetown Showroom, Georgetown Showroom', NULL);

-- Spas On Order: TS 6.2 | no-serial | Pending | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 6.2',
   NULL, NULL, 'Waco Showroom', NULL);

-- Spas On Order: TS 7.25 | no-serial | Pending | Waco Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.25',
   NULL, NULL, 'Waco Showroom', NULL);

-- Spas On Order: TS 8.2 | no-serial | Pending | Plano Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   NULL, NULL, 'Plano Showroom', NULL);

-- Spas On Order: X Thera 13 | no-serial | Pending | Plano Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'X Thera 13',
   NULL, NULL, 'Plano Showroom', NULL);

-- Spas On Order: C Bal 6 | no-serial | Sold | Apodaca-HOUDEL, Jason/Ginger
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'C Bal 6',
   '[Fierce] Houston Delivery | [Atlas] Delivery Time Frame: 2-3 months from 3/1/26
Sending to Houston w/ cover & steps from MS | [Expo] May-ish', 'houston_aaron', 'Apodaca-HOUDEL, Jason/Ginger', NULL);

-- Spas On Order: C Bal 6 | no-serial | Sold | Terrell/Marilynn Horne, Bruce/Beverly Bowman
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Smoky', 'DWAL2', 'WR', 'C Bal 6',
   '[Fierce] Aaron Delivery? | [Atlas] Delivery Time Frame: When spa arrives, but the lead time was mid april at that time.', NULL, 'Terrell/Marilynn Horne, Bruce/Beverly Bowman', NULL);

-- Spas On Order: C Bal 7 | no-serial | Sold | Jonathan Leger- HOUDEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   '[Fierce] HOUSTON Delivery | [Atlas] Deliver Time Frame: 2-4 weeks from 2/28/26
shipping w/ cover & steps from MS', 'houston_aaron', 'Jonathan Leger- HOUDEL', NULL);

-- Spas On Order: C Bal 7 | no-serial | Sold | Wilson -OKC/KS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Storm', 'GRAPH', 'WR', 'C Bal 7',
   '[Fierce] Ship to OKC | [Atlas] One of Ryan Frank''s previous customers
Ship w/ Steps & Cover | [Expo] OKC/KS', NULL, 'Wilson -OKC/KS', NULL);

-- Spas On Order: C Bal 8 | no-serial | Sold | Myers*, Mark
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] 8-12-25 not ready ck bk in 2 weeks LM 9-2-25 LM 9-8-25 9-9-25 not ready ck bk in 2 weeks LM 9-23-25 9-30-25 ck bk in 1 month 11-5-25 ck bk in 1 month 12-8-25 ck bk in feb 2-23-26 ck bk in 1 more month they have everything done just need a little bit more time LM 3-10-26 | [Atlas] Lives in Tucumcari, NM', 'fierce', 'Myers*, Mark', NULL);

-- Spas On Order: C Bal 8 | no-serial | Sold | Hinojosa*, Anthony/Meredith
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] 3-16-26 not rdy ck bk in 25 days | [Atlas] Delivery Time Frame:  30 days from 3/6/26 | [Expo] Next Truck!', 'fierce', 'Hinojosa*, Anthony/Meredith', NULL);

-- Spas On Order: C Bal 8 | no-serial | Sold | Tibbits, Daniel
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Tuscan', 'DWAL2', 'WR', 'C Bal 8',
   '[Fierce] OKC Delivery | [Atlas] Delivery Timeframe: May', NULL, 'Tibbits, Daniel', NULL);

-- Spas On Order: C Bal 8 | no-serial | Sold | Walters*, Donald/Deborah
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] LM 2-11-26, called back and said not ready, check back in 1 month (3-11-26). 3-19-26 been in/out hospital, ck bk 4/20/26.#5', 'fierce', 'Walters*, Donald/Deborah', NULL);

-- Spas On Order: C Bal 8 | no-serial | Sold | Brang, Michael/Mariana
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Time Frame: 30 days, but contingent/refundable for 30 days. | [Expo] Wait until contingency is removed, then bring it in.', 'fierce', 'Brang, Michael/Mariana', NULL);

-- Spas On Order: C Prec 7 | no-serial | Sold | Costas, Michael
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'MID', 'WR', 'C Prec 7',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Timeframe: 3-4 months from 2-7-26', NULL, 'Costas, Michael', NULL);

-- Spas On Order: C Prec 8 | no-serial | Sold | David-HOUDEL, Luke/Stacey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Fierce] Ordered this before I realized it would be a HOUSTON Delivery. | [Atlas] 10/30/25 - Per Aleena''s text, They will be ready after Christmas! Construction is taking forever | [Expo] After Christmas', 'houston_aaron', 'David-HOUDEL, Luke/Stacey', NULL);

-- Spas On Order: C Prec 8 | no-serial | Sold | Eoff*, Russell/Jacquelynn
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Prec 8',
   '[Fierce] SCHLD 4-25-26 | [Atlas] Have Rx, PIF in- House', 'fierce', 'Eoff*, Russell/Jacquelynn', NULL);

-- Spas On Order: CGA Terrain | no-serial | Sold | Cummins, James/Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'TAN', 'WR', 'CGA Terrain',
   '[Fierce] Fierce Delivery | [Atlas] 3-16-26 - told Aleena they will be ready in MAY | [Expo] MAY', 'fierce', 'Cummins, James/Michelle', NULL);

-- Spas On Order: LH L7 | no-serial | Sold | Reynolds, Larry/Toni
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH L7',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: 30 days from 3-28-26 | [Expo] NEXT TRUCK!', 'atlas', 'Reynolds, Larry/Toni', NULL);

-- Spas On Order: LSX 900 | no-serial | Sold | Scott*, Christopher/Colleen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'LSX 900',
   '[Fierce] 10-20-25 not ready need more time have to pull permits and need all of it to be approved call back in 30 days  LM 11-19-25 LM 11-20-25  check back 12-12-25. 12-18-25 vm full, sent txt. 1-6-25 Not ready waiting on HoA to approve things and want us to give him a call back on the first of feb 2-3-26 ck bk in march | [Atlas] Delivery Time Frame: Ready! Have Rx | [Expo] March', 'fierce', 'Scott*, Christopher/Colleen', NULL);

-- Spas On Order: LSX 900 | no-serial | Sold | Harris-OKC, Rose/Brandon
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'MID2', 'WR', 'LSX 900',
   '[Fierce] ARKANSAS DEL for OKC  4/23 - LM & txt. Terri has reached out many many times and haven''t been able to get ahold of them. | [Atlas] NO RX! Delivery Time Frame: 60-90 days April from 2-7-25. Nikki talked with Rose. No fence line. Should be able to drive right up to the ground level concrete pad without issues as long as the ground is dry. Customer will send photos when her area dries up. 3/11/26 - Nat reordered, per William.
Will ship w/cover & steps from MS. - Need to confirm where this unit is going if we don''t hear from the customer by the time this unit completes.  May want to bring it in as a stock unit in Texas. | [Expo] Was Atlas delivery, but it''s an hour closer for OKC.', NULL, 'Harris-OKC, Rose/Brandon', NULL);

-- Spas On Order: LSX 900 | no-serial | Sold | Harrison, Howard Kent
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Fierce] Atlas to Deliver | [Atlas] LA DEL, NO RX!
Delivery Timeframe: 30-45 days from 3-14-26 | [Expo] NEXT TRUCK', 'atlas', 'Harrison, Howard Kent', NULL);

-- Spas On Order: LSX 900 | no-serial | Sold | Sparlin, Joe/Lydia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Fierce] 2-16-26 not ready need more time ck bk mid to late march LM 3-13-26 3-23-26 call back in 6 weeks | [Atlas] PIF, Have Rx | [Expo] Mid May', NULL, 'Sparlin, Joe/Lydia', NULL);

-- Spas On Order: LSX 900 | no-serial | Sold | Haddock, Jason/Robin
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'LSX 900',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Time Frame: 2-4 weeks from 3-29-26 | [Expo] NEXT TRUCK!', 'fierce', 'Haddock, Jason/Robin', NULL);

-- Spas On Order: SG MP 2 | no-serial | Sold | Harvey/Soto - SWG, Edward/Sylvia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 2',
   '[Fierce] Aaron Delivery 11-12 txted | [Atlas] Customer also has purchased T21D, Have Rx', NULL, 'Harvey/Soto - SWG, Edward/Sylvia', NULL);

-- Spas On Order: SG MP 3 | no-serial | Sold | Cummins, James/Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 3',
   '[Fierce] Fierce Delivery | [Atlas] 3-16-26 - told Aleena they will be ready in MAY | [Expo] MAY', 'fierce', 'Cummins, James/Michelle', NULL);

-- Spas On Order: SG MP 3 | no-serial | Sold | Ramey - OKC/KS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 3',
   '[Fierce] Ship to OKC | [Atlas] One of Ryan Frank''s previous customers
Ship w/ Steps & Cover | [Expo] OKC/KS', NULL, 'Ramey - OKC/KS', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Griffin*, Henry/Audrey
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] 1-9-26 Atlas building deck, ck back 2/1/26. 1-29-26 waiting on city to get permits and Atlas still need to build deck 1st. 2-20 call back in 1 month #5 | [Atlas] Delivery Time Frame: January-February', 'fierce', 'Griffin*, Henry/Audrey', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Woods, Richard
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Storm', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] OKC Delivery | [Atlas] Delivery Timeframe: 8-10 weeks from 3-13-26 (puts delivery between 5-8-26 & 5-22-26)', NULL, 'Woods, Richard', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Post, Sidney
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Atlas to Deliver, 4/2 - sent to Terri to schedule | [Atlas] Delivery Timeframe: 30 days from 3-6-26 | [Expo] NEXT TRUCK', 'atlas', 'Post, Sidney', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Kilgore*, Keith/Terri
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] 3-18-26 will be ready in 3 wks. ck bk 4-8-26. | [Atlas] Delivery Time Frame: March-April | [Expo] NEXT TRUCK', 'fierce', 'Kilgore*, Keith/Terri', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Benson, Todd/Rachel
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Atlas to Deliver per Terri on 3-24-26 customer said "Not quite ready yet, will call" | [Atlas] Delivery Timeframe: 30-60 days from 1-17-26 | [Expo] NEXT TRUCK', 'atlas', 'Benson, Todd/Rachel', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Devore, James
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: 3-5 weeks from 3-29-26 | [Expo] NEXT TRUCK!', 'atlas', 'Devore, James', NULL);

-- Spas On Order: TS 8.2 | no-serial | Sold | Devereux, Julien
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Tuscan', 'DWAL2', 'WR', 'TS 8.2',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Timeframe: end of May - customer is ready', 'fierce', 'Devereux, Julien', NULL);

-- Spas On Order: TS 8.2 | no-serial | Sold | Lavender, Shannon/Jason
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'MID2', 'WR', 'TS 8.2',
   '[Fierce] Aaron Delivery | [Atlas] Delivery Time Frame: 3-4 months from 3-29-26', NULL, 'Lavender, Shannon/Jason', NULL);

-- Spas On Order: TS 8.2 | no-serial | Sold | Boothe, Quentin/Jennifer
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Tuscan', 'DWAL2', 'WR', 'TS 8.2',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: June 2026, have Rx', 'atlas', 'Boothe, Quentin/Jennifer', NULL);

-- Spas On Order: TS 8.25 | no-serial | Sold | Gremillion, Shon
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Midnight', 'MID2', 'WR', 'TS 8.25',
   '[Fierce] Atlas to Deliver | [Atlas] Delivery Time Frame: May', 'atlas', 'Gremillion, Shon', NULL);

-- Spas On Order: TS 8.25 | no-serial | Sold | Skelly, Craig/Alice
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 8.25',
   '[Fierce] Fierce Delivery | [Atlas] *Builder Program* Delivery Timeframe: 2-3 months from 1-19-26 | [Expo] End of March-End of April', 'fierce', 'Skelly, Craig/Alice', NULL);

-- Spas On Order: X T12 | no-serial | Sold | Reeves - OK DEL, Robert/Shannon
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'X T12',
   '[Fierce] Aqua haven doing delivery; this was already shipped to them. | [Atlas] Delivery Timeframe: customer is ready. I think?', NULL, 'Reeves - OK DEL, Robert/Shannon', NULL);

-- Spas On Order: X T12 | no-serial | Sold | Jackman-OKC/KS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'X T12',
   '[Fierce] Ship to OKC | [Atlas] One of Ryan Frank''s previous customers
Ship w/ Steps & Cover | [Expo] OKC/KS', NULL, 'Jackman-OKC/KS', NULL);

-- Spas On Order: X T15D | no-serial | Sold | Smalls - HOUDEL, Kerry
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'X T15D',
   '[Fierce] HOUSTON DELIVERY | [Atlas] Delivery Time Frame: May 2026, but will be ready sooner if possible.  
Will need 1 upright and 1 vanish lifter.', 'houston_aaron', 'Smalls - HOUDEL, Kerry', NULL);

-- Spas On Order: X T21D | no-serial | Sold | Kraus-OKC/KS
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'X T21D',
   '[Fierce] Ship to OKC w/ Axis cover | [Atlas] One of Ryan Frank''s previous customers
Ship w/ Steps & AXIS Cover | [Expo] OKC/KS', NULL, 'Kraus-OKC/KS', NULL);

-- Spas On Order: X Thera SE | no-serial | Sold | Baker, Tonya/Billy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'X Thera SE',
   '[Fierce] Fierce Delivery | [Atlas] Contingent until 4/1/26 - DON''T ORDER UNTIL WE HAVE A FULL PAYMENT.  Nat just wanted to put this here instead of Per Tim since it may become good in 2 days.', 'fierce', 'Baker, Tonya/Billy', NULL);

-- Spas On Order: C Bal 6 | no-serial | Stock | Victoria Dulaney-OKC
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 6',
   '[Atlas] will ship w/ cover & steps', NULL, 'Victoria Dulaney-OKC', NULL);

-- Spas On Order: C Bal 6 | no-serial | Stock | Terrell/Marilynn Horne
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Smoky', 'DWAL2', 'WR', 'C Bal 6',
   '[Fierce] STOCK', NULL, 'Terrell/Marilynn Horne', NULL);

-- Spas On Order: C Bal 6 CS | no-serial | Stock | Ryan Coad
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 6 CS',
   '[Fierce] STOCK', NULL, 'Ryan Coad', NULL);

-- Spas On Order: C Bal 7 | no-serial | Stock | Chris/Sylvia Sinclair
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 7',
   NULL, NULL, 'Chris/Sylvia Sinclair', NULL);

-- Spas On Order: C Bal 8 | no-serial | Stock | Brenda/Michael Wortman
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] STOCK', NULL, 'Brenda/Michael Wortman', NULL);

-- Spas On Order: C Bal 8 | no-serial | Stock | Donald/Deborah Walters
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Bal 8',
   '[Fierce] STOCK', NULL, 'Donald/Deborah Walters', NULL);

-- Spas On Order: C Bal 9 | no-serial | Pending | Plano Showroom, Plano Showroom
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'C Bal 9',
   NULL, NULL, 'Plano Showroom, Plano Showroom', NULL);

-- Spas On Order: C Prec 7 | no-serial | Stock | Tommy/Barbara Gray
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   '[Fierce] STOCK', NULL, 'Tommy/Barbara Gray', NULL);

-- Spas On Order: G Ocho CS | no-serial | Stock | William "Bill" Flynn
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'SeaSalt', 'GRAPH', 'WR', 'G Ocho CS',
   NULL, NULL, 'William "Bill" Flynn', NULL);

-- Spas On Order: LH 5 | no-serial | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH 5',
   NULL, NULL, NULL, NULL);

-- Spas On Order: LH 5 | no-serial | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH 5',
   NULL, NULL, NULL, NULL);

-- Spas On Order: LH 5 | no-serial | Stock | 
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH 5',
   NULL, NULL, NULL, NULL);

-- Spas On Order: LH L7 | no-serial | Stock | Lucas Collins
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH L7',
   '[Fierce] STOCK', NULL, 'Lucas Collins', NULL);

-- Spas On Order: LH S6 | no-serial | Stock | Steven Ferrell
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'LH S6',
   '[Fierce] STOCK', NULL, 'Steven Ferrell', NULL);

-- Spas On Order: SG MP 2 | no-serial | Stock | STOCK B, STOCK B
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 2',
   '[Fierce] STOCK | [Expo] Next Truck', NULL, 'STOCK B, STOCK B', NULL);

-- Spas On Order: SG MP 3 | no-serial | Stock | STOCK C, STOCK C
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 3',
   '[Fierce] STOCK | [Expo] Next Truck', NULL, 'STOCK C, STOCK C', NULL);

-- Spas On Order: SG MP 3 | no-serial | Stock | STOCK D, STOCK D
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'N/A', 'N/A', 'WR', 'SG MP 3',
   '[Fierce] STOCK | [Expo] Next Truck', NULL, 'STOCK D, STOCK D', NULL);

-- Spas On Order: TS 240X | no-serial | Stock | Barbara Anglin
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 240X',
   NULL, NULL, 'Barbara Anglin', NULL);

-- Spas On Order: TS 7.2 | no-serial | Stock | Robert McMillan
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] STOCK', NULL, 'Robert McMillan', NULL);

-- Spas On Order: TS 7.2 | no-serial | Stock | Sherri Highfill*
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] STOCK', NULL, 'Sherri Highfill*', NULL);

-- Spas On Order: TS 8.2 | no-serial | Stock | Michael McDonald
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   NULL, NULL, 'Michael McDonald', NULL);

-- Spas On Order: TS 8.2 | no-serial | Stock | Stephan/Rebecca Hancock-HOUDEL
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 8.2',
   '[Fierce] STOCK', NULL, 'Stephan/Rebecca Hancock-HOUDEL', NULL);

-- Spas On Order: TS 8.25 | no-serial | Stock | Dru Kitchen
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'MID2', 'WR', 'TS 8.25',
   NULL, NULL, 'Dru Kitchen', NULL);

-- Spas On Order: TS 8.25 | no-serial | Stock | Kristie/Wesley Millican
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'UN', 'TS 8.25',
   '[Fierce] STOCK', NULL, 'Kristie/Wesley Millican', NULL);

-- Spas On Order: X T15D | no-serial | Stock | Gregory/Jolene Bethune
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Fierce] STOCK', NULL, 'Gregory/Jolene Bethune', NULL);

-- Spas On Order: X T15D | no-serial | Stock | Jackie "Jack" Bailes
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'X T15D',
   '[Fierce] STOCK', NULL, 'Jackie "Jack" Bailes', NULL);

-- Spas On Order: X T21D | no-serial | Stock | Crystal/Matt Wooley
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'White', 'GRAPH', 'WR', 'X T21D',
   NULL, NULL, 'Crystal/Matt Wooley', NULL);

-- Spas On Order: X Thera 15 | no-serial | Stock | Andrew Sackerson
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'DWAL2', 'WR', 'X Thera 15',
   '[Fierce] STOCK', NULL, 'Andrew Sackerson', NULL);

-- Spas On Order: X T19D MAX | no-serial | Sold | Smith, Shannon/Jeremy
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'X T19D MAX',
   '[Fierce] Aaron Delivery | [Atlas] $2K down, but closing on home April 20th. Pad will be poured on April 21st.', NULL, 'Smith, Shannon/Jeremy', NULL);

-- Spas On Order: X T19D MAX | no-serial | Sold | Sanchez, Daniel
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'X T19D MAX',
   '[Fierce] Fierce Delivery | [Atlas] Delivery Timeframe: 45-60 days from 3-30-26', 'fierce', 'Sanchez, Daniel', NULL);

-- Spas On Order: X Ch15D | no-serial | Sold | Coleman-OKC, Robert
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'X Ch15D',
   '[Fierce] OKC Delivery | [Atlas] Delivery Timeframe: order; sale date was 3-18-26;  4/1/26 - Per Ryan, don''t order w/ Heat Pump yet waiting to see if the customer is willing to wait for it.  Also ordered w/ Axis cover, but may switch to standard cover.', NULL, 'Coleman-OKC, Robert', NULL);

-- Spas On Order: TS 7.2 | no-serial | Sold | Conner, James/Julia
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Atlas to Deliver 4-23-26 | [Atlas] Delivery timeframe: asap within 30 days from 3-30-26', 'atlas', 'Conner, James/Julia', NULL);

-- Spas On Order: C Prec 7 | no-serial | Stock | John/Lauren Thompson
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, order_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, NULL, 'on_order', 'stock', NULL,
   'Sterling', 'GRAPH', 'WR', 'C Prec 7',
   NULL, NULL, 'John/Lauren Thompson', NULL);

-- Take to Waco: X T21D | H253201 | Sold | Raj, Katherine
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', 'H253201',
   'White', 'GRAPH', 'WR', 'X T21D',
   '[Fierce] Aaron Delivery

may only be able to do Saturday Delivery. Jonas and Natalia are both trying to get ahold of them, but Natalia mentioned they may not be able to hit the desired timeframe from the customer if it has to be a Saturday. She will let us know. | [Atlas] Need Rx; Delivery Time Frame: 4-6 weeks from 1-10-26, Saturday delivery | [Expo] La Grange, TX - 30 min southeast of Austin.. 

*Cant switch SN* - there isn''t one in Austin', NULL, 'Raj, Katherine', '$45,460.02 (spa) + $3,068.89 (CGB)');

-- Take to Waco: TS 7.2 | 2604048 | Sold | Sommer, Michelle
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2604048',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Aaron Delivery | [Atlas] Delivery Time Frame: After Alex builds a deck.', NULL, 'Sommer, Michelle', 'Need to Print');

-- Take to Waco: TS 7.2 | 2604051 | Sold | Kehoe, David/Robin
INSERT INTO public.inventory_units
  (product_id, location_id, status, unit_type, serial_number,
   shell_color, cabinet_color, wrap_status, model_code,
   notes, delivery_team, customer_name, fin_balance)
VALUES
  (NULL, (SELECT id FROM public.locations WHERE name = 'Waco Showroom' LIMIT 1), 'allocated', 'stock', '2604051',
   'Sterling', 'GRAPH2', 'WR', 'TS 7.2',
   '[Fierce] Aaron Delivery - 3/30 - Wants to switch to vanish cover lifter. Need to update contract. | [Atlas] Delivery Time Frame: ASAP', NULL, 'Kehoe, David/Robin', 'Need to Print');

COMMIT;

-- 524 units inserted, 8 empty rows skipped