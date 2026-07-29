-- ============================================================
-- AXI
-- Compatibilidad para llamadas internas a log_finance_event
-- ============================================================

create or replace function public.log_finance_event(
  p_action text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_entity_uuid uuid;
  v_driver_id uuid;
  v_amount numeric;
begin
  if nullif(btrim(p_action), '') is null then
    raise exception 'La acción del evento financiero es obligatoria';
  end if;

  if nullif(btrim(p_entity_id), '') is null then
    raise exception 'El identificador de la entidad es obligatorio';
  end if;

  begin
    v_entity_uuid := p_entity_id::uuid;
  exception
    when invalid_text_representation then
      raise exception
        'El identificador del evento financiero no es un UUID válido: %',
        p_entity_id;
  end;

  /*
    Primero intentamos obtener el conductor desde la metadata.
    Si no está presente, lo buscamos utilizando el identificador
    de payment_transactions.
  */
  begin
    v_driver_id :=
      nullif(p_metadata ->> 'driver_id', '')::uuid;
  exception
    when invalid_text_representation then
      v_driver_id := null;
  end;

  if v_driver_id is null then
    select pt.driver_id
    into v_driver_id
    from public.payment_transactions pt
    where pt.id = v_entity_uuid;
  end if;

  /*
    Determinamos el importe relacionado con el evento.
    Para el fallo recibido puede no existir todavía un monto
    explícito dentro de la metadata.
  */
  begin
    v_amount :=
      coalesce(
        nullif(p_metadata ->> 'driver_pending_reversed', '')::numeric,
        nullif(p_metadata ->> 'driver_net_earnings', '')::numeric
      );
  exception
    when invalid_text_representation then
      v_amount := null;
  end;

  return public.log_finance_event(
    p_target_driver_id => v_driver_id,
    p_action           => p_action,
    p_entity_type      => 'payment_transaction',
    p_entity_id        => v_entity_uuid,
    p_amount           => v_amount,
    p_metadata         => coalesce(p_metadata, '{}'::jsonb)
  );
end;
$function$;

comment on function public.log_finance_event(text, text, jsonb) is
  'Sobrecarga de compatibilidad que adapta eventos de pagos digitales a la firma oficial de log_finance_event.';

revoke all
on function public.log_finance_event(text, text, jsonb)
from public;

grant execute
on function public.log_finance_event(text, text, jsonb)
to authenticated, service_role;
