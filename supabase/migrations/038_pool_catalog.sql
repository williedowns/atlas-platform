-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 038: Pool Catalog Seed
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Seeds the products table with the 2026 pool models from Aqua Haven price sheets
-- (Ryan Frank, forwarded by Alex 2026-04-28):
--   - Latham Fiberglass (Grand Dealer)
--   - Barrier Reef Fiberglass
--   - Above-Ground (Aqua Haven) — Southport, Nakoma, Sentinelle
--
-- Prices are MSRP. Winter discount ($2,000 on fiberglass) applied separately at sale.
-- All sales tax excluded.

INSERT INTO public.products (name, sku, category, msrp, active) VALUES
  -- Latham Fiberglass — Premium tier
  ('Astoria 14',    'LATHAM-ASTORIA-14',    'Latham Fiberglass Pools', 86999, true),
  ('Axiom 16',      'LATHAM-AXIOM-16',      'Latham Fiberglass Pools', 76521, true),
  ('Barcelona',     'LATHAM-BARCELONA',     'Latham Fiberglass Pools', 79733, true),
  ('Cambridge',     'LATHAM-CAMBRIDGE',     'Latham Fiberglass Pools', 76733, true),
  ('Caribbean',     'LATHAM-CARIBBEAN',     'Latham Fiberglass Pools', 79381, true),
  ('Corinthian 16', 'LATHAM-CORINTHIAN-16', 'Latham Fiberglass Pools', 79491, true),
  ('Fiji',          'LATHAM-FIJI',          'Latham Fiberglass Pools', 71999, true),
  ('Gulf Coast',    'LATHAM-GULF-COAST',    'Latham Fiberglass Pools', 80999, true),
  ('Gulf Shores',   'LATHAM-GULF-SHORES',   'Latham Fiberglass Pools', 78658, true),
  ('Kingston',      'LATHAM-KINGSTON',      'Latham Fiberglass Pools', 81072, true),
  ('Monaco',        'LATHAM-MONACO',        'Latham Fiberglass Pools', 78395, true),
  ('Olympia 16',    'LATHAM-OLYMPIA-16',    'Latham Fiberglass Pools', 80999, true),
  ('Synergy',       'LATHAM-SYNERGY',       'Latham Fiberglass Pools', 81023, true),
  ('Astoria 16',    'LATHAM-ASTORIA-16',    'Latham Fiberglass Pools', 96549, true),
  -- Latham Fiberglass — Mid tier
  ('Apollo 14',     'LATHAM-APOLLO-14',     'Latham Fiberglass Pools', 71999, true),
  ('Axiom 14',      'LATHAM-AXIOM-14',      'Latham Fiberglass Pools', 68999, true),
  ('Claremont',     'LATHAM-CLAREMONT',     'Latham Fiberglass Pools', 67872, true),
  ('Corinthian 14', 'LATHAM-CORINTHIAN-14', 'Latham Fiberglass Pools', 73123, true),
  ('Laguna',        'LATHAM-LAGUNA',        'Latham Fiberglass Pools', 68310, true),
  ('Laguna Deluxe', 'LATHAM-LAGUNA-DELUXE', 'Latham Fiberglass Pools', 79999, true),
  ('Olympia 14',    'LATHAM-OLYMPIA-14',    'Latham Fiberglass Pools', 72999, true),
  ('Providence 14', 'LATHAM-PROVIDENCE-14', 'Latham Fiberglass Pools', 72899, true),
  ('Rockport',      'LATHAM-ROCKPORT',      'Latham Fiberglass Pools', 64999, true),
  ('St. Thomas',    'LATHAM-ST-THOMAS',     'Latham Fiberglass Pools', 67999, true),
  ('Tuscan 14.27',  'LATHAM-TUSCAN-1427',   'Latham Fiberglass Pools', 68999, true),
  ('Valencia',      'LATHAM-VALENCIA',      'Latham Fiberglass Pools', 66299, true),
  ('Coral 16',      'LATHAM-CORAL-16',      'Latham Fiberglass Pools', 71999, true),
  -- Latham Fiberglass — Small tier
  ('Aruba',         'LATHAM-ARUBA',         'Latham Fiberglass Pools', 51665, true),
  ('Bermuda',       'LATHAM-BERMUDA',       'Latham Fiberglass Pools', 53216, true),
  ('Corinthian 12', 'LATHAM-CORINTHIAN-12', 'Latham Fiberglass Pools', 56545, true),
  ('Delray',        'LATHAM-DELRAY',        'Latham Fiberglass Pools', 53614, true),
  ('Jamaica',       'LATHAM-JAMAICA',       'Latham Fiberglass Pools', 45761, true),
  ('Key West',      'LATHAM-KEY-WEST',      'Latham Fiberglass Pools', 52877, true),
  ('Milan',         'LATHAM-MILAN',         'Latham Fiberglass Pools', 46922, true),
  ('Olympia 12',    'LATHAM-OLYMPIA-12',    'Latham Fiberglass Pools', 57154, true),
  ('St. Lucia',     'LATHAM-ST-LUCIA',      'Latham Fiberglass Pools', 48253, true),
  ('Tuscan 11.20',  'LATHAM-TUSCAN-1120',   'Latham Fiberglass Pools', 47964, true),
  ('Tuscan 13.24',  'LATHAM-TUSCAN-1324',   'Latham Fiberglass Pools', 56690, true),

  -- Barrier Reef Fiberglass — Premium tier (35' / 40')
  ('Billabong 35''',          'BR-BILLABONG-35',          'Barrier Reef Fiberglass Pools', 76999, true),
  ('Grande 35''',             'BR-GRANDE-35',             'Barrier Reef Fiberglass Pools', 76521, true),
  ('Coral Sea 35''',          'BR-CORAL-SEA-35',          'Barrier Reef Fiberglass Pools', 79733, true),
  ('Coral Sea 35'' L',        'BR-CORAL-SEA-35-L',        'Barrier Reef Fiberglass Pools', 76733, true),
  ('Whitsunday 35''',         'BR-WHITSUNDAY-35',         'Barrier Reef Fiberglass Pools', 79381, true),
  ('Whitsunday 35'' L',       'BR-WHITSUNDAY-35-L',       'Barrier Reef Fiberglass Pools', 79491, true),
  ('Bondi 35''',              'BR-BONDI-35',              'Barrier Reef Fiberglass Pools', 81999, true),
  ('Bondi 40''',              'BR-BONDI-40',              'Barrier Reef Fiberglass Pools', 80999, true),
  ('Coral Sea 40''',          'BR-CORAL-SEA-40',          'Barrier Reef Fiberglass Pools', 78658, true),
  ('Whitsunday 40''',         'BR-WHITSUNDAY-40',         'Barrier Reef Fiberglass Pools', 81072, true),
  ('Whitsunday DEEP',         'BR-WHITSUNDAY-DEEP',       'Barrier Reef Fiberglass Pools', 88395, true),
  ('Daydream 40''',           'BR-DAYDREAM-40',           'Barrier Reef Fiberglass Pools', 91999, true),
  ('Sydney Harbour 35''',     'BR-SYDNEY-HARBOUR-35',     'Barrier Reef Fiberglass Pools', 91023, true),
  ('Sydney Harbour 40''',     'BR-SYDNEY-HARBOUR-40',     'Barrier Reef Fiberglass Pools', 97549, true),
  -- Barrier Reef — Mid tier (30' / 31')
  ('Oyster 30''',             'BR-OYSTER-30',             'Barrier Reef Fiberglass Pools', 67999, true),
  ('Outback 30''',            'BR-OUTBACK-30',            'Barrier Reef Fiberglass Pools', 65872, true),
  ('Outback 30'' L',          'BR-OUTBACK-30-L',          'Barrier Reef Fiberglass Pools', 64123, true),
  ('Outback Dundee',          'BR-OUTBACK-DUNDEE',        'Barrier Reef Fiberglass Pools', 67310, true),
  ('Outback Dundee L',        'BR-OUTBACK-DUNDEE-L',      'Barrier Reef Fiberglass Pools', 67999, true),
  ('Whitsunday 30''',         'BR-WHITSUNDAY-30',         'Barrier Reef Fiberglass Pools', 71999, true),
  ('Whitsunday 30'' L',       'BR-WHITSUNDAY-30-L',       'Barrier Reef Fiberglass Pools', 72899, true),
  ('Coral Sea 31''',          'BR-CORAL-SEA-31',          'Barrier Reef Fiberglass Pools', 69999, true),
  ('Coral Sea 31'' L',        'BR-CORAL-SEA-31-L',        'Barrier Reef Fiberglass Pools', 71999, true),
  ('Castaway 30''',           'BR-CASTAWAY-30',           'Barrier Reef Fiberglass Pools', 84999, true),
  ('Castaway 35''',           'BR-CASTAWAY-35',           'Barrier Reef Fiberglass Pools', 91299, true),
  -- Barrier Reef — Small tier (23'-29')
  ('Outback Escape',          'BR-OUTBACK-ESCAPE',        'Barrier Reef Fiberglass Pools', 49665, true),
  ('Crispin',                 'BR-CRISPIN',               'Barrier Reef Fiberglass Pools', 51216, true),
  ('Pixie',                   'BR-PIXIE',                 'Barrier Reef Fiberglass Pools', 51414, true),
  ('Opal',                    'BR-OPAL',                  'Barrier Reef Fiberglass Pools', 52639, true),
  ('Milano',                  'BR-MILANO',                'Barrier Reef Fiberglass Pools', 52979, true),
  ('Grande 23''',             'BR-GRANDE-23',             'Barrier Reef Fiberglass Pools', 54761, true),
  ('Outback 23''',            'BR-OUTBACK-23',            'Barrier Reef Fiberglass Pools', 55877, true),
  ('Sudbury 25''',            'BR-SUDBURY-25',            'Barrier Reef Fiberglass Pools', 56922, true),
  ('Oyster 27''',             'BR-OYSTER-27',             'Barrier Reef Fiberglass Pools', 60154, true),
  ('Billabong 27''',          'BR-BILLABONG-27',          'Barrier Reef Fiberglass Pools', 63253, true),
  ('Southport 28''',          'BR-SOUTHPORT-28',          'Barrier Reef Fiberglass Pools', 62964, true),
  ('Sudbury 29''',            'BR-SUDBURY-29',            'Barrier Reef Fiberglass Pools', 63690, true),
  ('Grande 29''',             'BR-GRANDE-29',             'Barrier Reef Fiberglass Pools', 65073, true),

  -- Above-Ground — Southport (Cash & Carry)
  ('Southport 18'' Round',    'AG-SOUTHPORT-18',          'Above-Ground Pools', 4099,  true),
  ('Southport 21'' Round',    'AG-SOUTHPORT-21',          'Above-Ground Pools', 4299,  true),
  ('Southport 24'' Round',    'AG-SOUTHPORT-24',          'Above-Ground Pools', 4599,  true),
  ('Southport 27'' Round',    'AG-SOUTHPORT-27',          'Above-Ground Pools', 4799,  true),
  ('Southport 30'' Round',    'AG-SOUTHPORT-30',          'Above-Ground Pools', 5099,  true),
  ('Southport 33'' Round',    'AG-SOUTHPORT-33',          'Above-Ground Pools', 5799,  true),
  -- Above-Ground — Nakoma (installed)
  ('Nakoma 18'' Round',       'AG-NAKOMA-18',             'Above-Ground Pools', 8999,  true),
  ('Nakoma 21'' Round',       'AG-NAKOMA-21',             'Above-Ground Pools', 9499,  true),
  ('Nakoma 24'' Round',       'AG-NAKOMA-24',             'Above-Ground Pools', 9999,  true),
  ('Nakoma 27'' Round',       'AG-NAKOMA-27',             'Above-Ground Pools', 10499, true),
  ('Nakoma 33'' Round',       'AG-NAKOMA-33',             'Above-Ground Pools', 12999, true),
  ('Nakoma 15x30 Oval',       'AG-NAKOMA-15X30-OVAL',     'Above-Ground Pools', 17299, true),
  ('Nakoma 18x33 Oval',       'AG-NAKOMA-18X33-OVAL',     'Above-Ground Pools', 19999, true),
  -- Above-Ground — Sentinelle (installed)
  ('Sentinelle 18'' Round',   'AG-SENTINELLE-18',         'Above-Ground Pools', 7899,  true),
  ('Sentinelle 21'' Round',   'AG-SENTINELLE-21',         'Above-Ground Pools', 8999,  true),
  ('Sentinelle 24'' Round',   'AG-SENTINELLE-24',         'Above-Ground Pools', 9499,  true),
  ('Sentinelle 27'' Round',   'AG-SENTINELLE-27',         'Above-Ground Pools', 9999,  true),
  ('Sentinelle 30'' Round',   'AG-SENTINELLE-30',         'Above-Ground Pools', 10999, true),
  ('Sentinelle 15x30 Oval',   'AG-SENTINELLE-15X30-OVAL', 'Above-Ground Pools', 16299, true),
  ('Sentinelle 18x33 Oval',   'AG-SENTINELLE-18X33-OVAL', 'Above-Ground Pools', 18999, true)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  msrp = EXCLUDED.msrp,
  active = true;
