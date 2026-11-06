-- ===== SIMPAN SCRAMBLE BUAT BEST SOLVE =====
-- Jalankan SATU KALI di Supabase Dashboard > SQL Editor > Run
-- Project: ziibivkhualutrdiojto
--
-- Yang dilakukan:
--   1) tambah kolom scramble di public.rubik_scores
--   2) ganti RPC submit_rubik_score jadi 5 parameter (p_scramble)
--   3) isi scramble benchmark "excel" biar baris #1 tetap lengkap
--
-- Frontend tetap jalan walau SQL ini belum dijalankan: dia otomatis
-- balik ke RPC 4 parameter dan board lama tanpa scramble.

-- ===== 1) KOLOM SCRAMBLE =====
alter table public.rubik_scores
  add column if not exists scramble text;

-- ===== 2) RPC BARU =====
-- Fungsi lama (4 parameter) dihapus dulu supaya nggak ada overload ambigu.
drop function if exists public.submit_rubik_score(text, text, integer, text);

create or replace function public.submit_rubik_score(
  p_player_id text,
  p_name text,
  p_best_ms integer,
  p_scramble text default null,
  p_secret text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_player_id is null or length(btrim(p_player_id)) < 6 then
    raise exception 'bad player id';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'name required';
  end if;
  if p_best_ms is null or p_best_ms < 100 or p_best_ms > 3600000 then
    raise exception 'bad time';
  end if;
  -- baris benchmark cuma boleh diubah owner yang login
  if p_player_id = 'excel'
     and p_secret is distinct from '078319197472f315907470f49c47f597aec914f289c44b1c2cd187e141933d46' then
    raise exception 'reserved';
  end if;

  insert into public.rubik_scores (player_id, name, best_ms, scramble, updated_at)
  values (
    p_player_id,
    left(btrim(p_name), 20),
    p_best_ms,
    nullif(left(btrim(coalesce(p_scramble, '')), 80), ''),
    now()
  )
  on conflict (player_id) do update
    set best_ms = least(public.rubik_scores.best_ms, excluded.best_ms),
        name = excluded.name,
        -- scramble cuma ikut berubah kalau ini benar-benar rekor baru
        scramble = case
          when excluded.best_ms < public.rubik_scores.best_ms
            then coalesce(excluded.scramble, public.rubik_scores.scramble)
          else public.rubik_scores.scramble
        end,
        updated_at = case
          when excluded.best_ms < public.rubik_scores.best_ms then now()
          else public.rubik_scores.updated_at
        end;
end;
$$;

grant execute on function public.submit_rubik_score(text, text, integer, text, text)
  to anon, authenticated;

-- ===== 3) SCRAMBLE BENCHMARK =====
update public.rubik_scores
set scramble = 'R U2 F'' L D2 R'' B U'' F2 D L2 U'' R2 B'' D2 F U2 L'' B2 R'''
where player_id = 'excel' and scramble is null;

insert into public.rubik_scores (player_id, name, best_ms, scramble)
values ('excel', 'excel', 13950,
        'R U2 F'' L D2 R'' B U'' F2 D L2 U'' R2 B'' D2 F U2 L'' B2 R''')
on conflict (player_id) do nothing;

-- Cek cepat setelah run:
--   select player_id, name, best_ms, scramble
--   from public.rubik_scores
--   order by best_ms
--   limit 10;
