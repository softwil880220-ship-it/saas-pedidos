-- Reversa (aplicar a mano si hace falta deshacer):
-- DROP TRIGGER IF EXISTS bloquear_borrado_productos ON public.productos;
-- DROP TRIGGER IF EXISTS bloquear_borrado_items ON public.items_variantes;
-- DROP TRIGGER IF EXISTS bloquear_borrado_categorias ON public.categorias_variantes;
-- DROP FUNCTION IF EXISTS public.trg_bloquear_borrado_catalogo();
-- DROP FUNCTION IF EXISTS public.catalogo_en_uso(text, text);
-- DROP FUNCTION IF EXISTS public.catalogo_id_json(text);
-- DROP POLICY IF EXISTS categorias_variantes_delete ON public.categorias_variantes;
-- DROP POLICY IF EXISTS items_variantes_delete ON public.items_variantes;
-- DROP INDEX IF EXISTS public.idx_pedidos_lineas_detalle_gin;

-- Catálogo: lo que ya se usó (ventas, recetas, consumo interno) no se puede eliminar, solo desactivar.
-- Bloquea el borrado en la base con triggers y agrega las políticas DELETE que faltaban
-- en categorias_variantes e items_variantes. Es idempotente.
-- Aplicar manualmente en DEV y luego en PROD vía Supabase SQL Editor.
-- En PROD aplicar fuera de la ventana de ventas (el índice GIN bloquea escrituras en pedidos unos segundos).

BEGIN;

-- 1) Índice para buscar uso de productos/ítems en pedidos
create index if not exists idx_pedidos_lineas_detalle_gin
  on public.pedidos using gin (lineas_detalle jsonb_path_ops);

-- 2) Helper: id como JSON numérico si es numérico, o como texto si no
create or replace function public.catalogo_id_json(p_id text)
returns jsonb
language sql
immutable
as $f$
  select case when p_id ~ '^[0-9]+$' then to_jsonb(p_id::bigint) else to_jsonb(p_id) end
$f$;

-- 3) Función única de "en uso": devuelve la razón o null si está libre
create or replace function public.catalogo_en_uso(p_tipo text, p_id text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $f$
declare v_neg uuid; v_cat uuid; v_num jsonb;
begin
  if p_tipo = 'producto' then
    select negocio_id into v_neg from public.productos where id::text = p_id;
    if v_neg is null then return null; end if;
    v_num := public.catalogo_id_json(p_id);
    if exists (select 1 from public.inventario_consumo_interno where producto_id::text = p_id) then return 'consumo_interno'; end if;
    if exists (select 1 from public.insumo_recetas where producto_id::text = p_id) then return 'receta'; end if;
    if exists (select 1 from public.pedidos where negocio_id = v_neg
               and (lineas_detalle @> jsonb_build_array(jsonb_build_object('productoId', p_id))
                 or lineas_detalle @> jsonb_build_array(jsonb_build_object('productoId', v_num)))) then return 'ventas'; end if;
    if exists (select 1 from public.mesas_folios where negocio_id = v_neg
               and jsonb_path_exists(carrito_snapshot, '$.** ? (@.productoId == $s || @.productoId == $n)',
                                     jsonb_build_object('s', p_id, 'n', v_num))) then return 'ventas'; end if;
    return null;
  elsif p_tipo = 'item' then
    select c.negocio_id, i.categoria_id into v_neg, v_cat
      from public.items_variantes i join public.categorias_variantes c on c.id = i.categoria_id
      where i.id = p_id::uuid;
    if v_neg is null then return null; end if;
    if exists (select 1 from public.insumo_recetas_variantes where item_variante_id = p_id::uuid) then return 'receta'; end if;
    if exists (select 1 from public.pedidos where negocio_id = v_neg
               and lineas_detalle @> jsonb_build_array(jsonb_build_object('variantes',
                     jsonb_build_object(v_cat::text, jsonb_build_array(p_id))))) then return 'ventas'; end if;
    if exists (select 1 from public.mesas_folios where negocio_id = v_neg
               and carrito_snapshot::text like '%' || p_id || '%') then return 'ventas'; end if;
    return null;
  elsif p_tipo = 'categoria' then
    if exists (select 1 from public.items_variantes where categoria_id = p_id::uuid) then return 'items'; end if;
    return null;
  end if;
  raise exception 'catalogo_en_uso: tipo inválido %', p_tipo;
end
$f$;

revoke all on function public.catalogo_en_uso(text, text) from public, anon;
grant execute on function public.catalogo_en_uso(text, text) to authenticated, service_role;
grant execute on function public.catalogo_id_json(text) to authenticated, service_role;

-- 4) Triggers que bloquean el borrado de lo que está en uso
create or replace function public.trg_bloquear_borrado_catalogo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $f$
declare v_razon text;
begin
  -- Bypass de mantenimiento: set local app.permitir_borrado_catalogo = 'on';
  if coalesce(current_setting('app.permitir_borrado_catalogo', true), '') = 'on' then
    return old;
  end if;
  v_razon := public.catalogo_en_uso(tg_argv[0], old.id::text);
  if v_razon is not null then
    raise exception 'No se puede eliminar: %', case v_razon
      when 'ventas' then 'ya se usó en pedidos. Desactívalo en su lugar.'
      when 'receta' then 'está en una receta de inventario. Quítalo de la receta o desactívalo.'
      when 'consumo_interno' then 'tiene consumo interno registrado. Desactívalo en su lugar.'
      when 'items' then 'todavía tiene ítems. Elimínalos o desactiva la categoría.'
      else v_razon end
      using errcode = '23503', hint = v_razon;
  end if;
  return old;
end
$f$;

drop trigger if exists bloquear_borrado_productos on public.productos;
create trigger bloquear_borrado_productos before delete on public.productos
  for each row execute function public.trg_bloquear_borrado_catalogo('producto');

drop trigger if exists bloquear_borrado_items on public.items_variantes;
create trigger bloquear_borrado_items before delete on public.items_variantes
  for each row execute function public.trg_bloquear_borrado_catalogo('item');

drop trigger if exists bloquear_borrado_categorias on public.categorias_variantes;
create trigger bloquear_borrado_categorias before delete on public.categorias_variantes
  for each row execute function public.trg_bloquear_borrado_catalogo('categoria');

-- 5) Políticas de DELETE que faltaban (solo del propio negocio)
drop policy if exists categorias_variantes_delete on public.categorias_variantes;
create policy categorias_variantes_delete on public.categorias_variantes
  for delete to authenticated
  using (negocio_id = public.usuario_negocio_id());

drop policy if exists items_variantes_delete on public.items_variantes;
create policy items_variantes_delete on public.items_variantes
  for delete to authenticated
  using (categoria_id in (select id from public.categorias_variantes
                          where negocio_id = public.usuario_negocio_id()));

COMMIT;
