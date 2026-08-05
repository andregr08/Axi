-- ============================================================
-- AXI: RETIROS, SPEI Y CONCILIACIÓN BANCARIA
-- ============================================================

-- ============================================================
-- 1. CAMPOS OPERATIVOS Y DE CONCILIACIÓN
-- ============================================================

alter table public.withdraw_requests
  add column if not exists transfer_provider text null,

  add column if not exists spei_tracking_key text null,

  add column if not exists provider_transfer_id text null,

  add column if not exists receipt_url text null,

  add column if not exists provider_payload jsonb
    not null default '{}'::jsonb,

  add column if not exists reconciliation_status text
    not null default 'pending',

  add column if not exists reconciled_at timestamptz null,

  add column if not exists reconciled_by uuid null,

  add column if not exists reconciliation_notes text null;


-- ============================================================
-- 2. VALIDACIONES
-- ============================================================

alter table public.withdraw_requests
  drop constraint if exists
    withdraw_requests_reconciliation_status_check;

alter table public.withdraw_requests
  add constraint
    withdraw_requests_reconciliation_status_check
  check (
    reconciliation_status in (
      'pending',
      'matched',
      'mismatch',
      'not_required'
    )
  );


alter table public.withdraw_requests
  drop constraint if exists
    withdraw_requests_reconciled_fields_check;

alter table public.withdraw_requests
  add constraint
    withdraw_requests_reconciled_fields_check
  check (
    (
      reconciliation_status = 'pending'
      and reconciled_at is null
      and reconciled_by is null
    )
    or
    (
      reconciliation_status in (
        'matched',
        'mismatch',
        'not_required'
      )
      and reconciled_at is not null
    )
  );


-- ============================================================
-- 3. ÍNDICES
-- ============================================================

create index if not exists
  withdraw_requests_reconciliation_status_idx
on public.withdraw_requests (
  reconciliation_status,
  paid_at desc
);


create index if not exists
  withdraw_requests_spei_tracking_key_idx
on public.withdraw_requests (
  spei_tracking_key
)
where spei_tracking_key is not null;


create index if not exists
  withdraw_requests_provider_transfer_id_idx
on public.withdraw_requests (
  provider_transfer_id
)
where provider_transfer_id is not null;


create index if not exists
  withdraw_requests_provider_reference_idx
on public.withdraw_requests (
  provider_reference
)
where provider_reference is not null;


-- ============================================================
-- 4. COMENTARIOS
-- ============================================================

comment on column
  public.withdraw_requests.transfer_provider
is
  'Proveedor o banco utilizado para ejecutar la transferencia del retiro.';


comment on column
  public.withdraw_requests.spei_tracking_key
is
  'Clave de rastreo SPEI asociada al retiro pagado.';


comment on column
  public.withdraw_requests.provider_transfer_id
is
  'Identificador interno de la transferencia en el proveedor.';


comment on column
  public.withdraw_requests.receipt_url
is
  'Ubicación del comprobante o CEP asociado al retiro.';


comment on column
  public.withdraw_requests.provider_payload
is
  'Payload técnico del proveedor de transferencias para auditoría.';


comment on column
  public.withdraw_requests.reconciliation_status
is
  'Estado de conciliación bancaria del retiro: pending, matched, mismatch o not_required.';


comment on column
  public.withdraw_requests.reconciled_at
is
  'Fecha en que Finanzas realizó la conciliación del retiro.';


comment on column
  public.withdraw_requests.reconciled_by
is
  'Usuario que realizó la conciliación bancaria del retiro.';


-- ============================================================
-- 5. CONTABILIDAD DE LIBERACIÓN POR RECHAZO
-- ============================================================

create or replace function public.trigger_post_withdrawal_to_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_driver_payable uuid;
  v_driver_reserved uuid;
  v_bank uuid;
  v_entries jsonb;
begin
  if new.amount is null or new.amount <= 0 then
    raise exception
      'El retiro % no tiene un monto contable válido',
      new.id;
  end if;

  v_driver_payable :=
    public.require_financial_account(
      'liability.driver_payable'
    );

  v_driver_reserved :=
    public.require_financial_account(
      'liability.driver_reserved'
    );

  v_bank :=
    public.require_financial_account(
      'asset.bank'
    );

  -- -------------------------------------------------------
  -- RESERVA DEL RETIRO
  -- -------------------------------------------------------

  if (
    (
      tg_op = 'INSERT'
      and new.reserved_at is not null
    )
    or
    (
      tg_op = 'UPDATE'
      and old.reserved_at is null
      and new.reserved_at is not null
    )
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_payable,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          'Disminución de saldo disponible por retiro reservado',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'withdrawal_status', new.status,
          'accounting_event', 'withdrawal_reserved'
        )
      ),
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Obligación reservada para pago al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'withdrawal_status', new.status,
          'accounting_event', 'withdrawal_reserved'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_reserved',

      p_description =>
        format(
          'Reserva de retiro %s del conductor %s',
          new.id,
          new.driver_id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'withdrawal-reserved:' || new.id::text || ':v1',

      p_withdrawal_id =>
        new.id,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'status', new.status,
          'reserved_at', new.reserved_at,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        coalesce(new.reserved_at, new.requested_at, now())
    );
  end if;

  -- -------------------------------------------------------
  -- PAGO DEL RETIRO
  -- -------------------------------------------------------

  if (
    (
      tg_op = 'INSERT'
      and new.status = 'paid'
    )
    or
    (
      tg_op = 'UPDATE'
      and old.status is distinct from 'paid'
      and new.status = 'paid'
    )
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          'Cancelación del retiro reservado al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'provider_reference', new.provider_reference,
          'accounting_event', 'withdrawal_paid'
        )
      ),
      jsonb_build_object(
        'account_id', v_bank,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Salida bancaria por retiro pagado',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'bank_name', new.bank_name,
          'provider_reference', new.provider_reference,
          'accounting_event', 'withdrawal_paid'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_paid',

      p_description =>
        format(
          'Pago del retiro %s al conductor %s',
          new.id,
          new.driver_id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'withdrawal-paid:' || new.id::text || ':v1',

      p_withdrawal_id =>
        new.id,

      p_provider_reference =>
        new.provider_reference,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'bank_name', new.bank_name,
          'provider_reference', new.provider_reference,
          'status', new.status,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        coalesce(new.paid_at, now())
    );
  end if;

  -- -------------------------------------------------------
  -- LIBERACIÓN DE RESERVA POR FALLO O RECHAZO
  -- -------------------------------------------------------

  if (
    tg_op = 'UPDATE'
    and (
      (
        old.status is distinct from 'failed'
        and new.status = 'failed'
      )
      or
      (
        old.status is distinct from 'rejected'
        and new.status = 'rejected'
      )
    )
    and new.reserved_at is not null
  ) then
    v_entries := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_driver_reserved,
        'direction', 'debit',
        'amount', new.amount,
        'description',
          case
            when new.status = 'rejected'
              then 'Liberación de retiro reservado rechazado'
            else 'Liberación de retiro reservado fallido'
          end,
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'failure_reason', new.failure_reason,
          'rejection_reason', new.notes,
          'release_status', new.status,
          'accounting_event',
            'withdrawal_reservation_released'
        )
      ),
      jsonb_build_object(
        'account_id', v_driver_payable,
        'direction', 'credit',
        'amount', new.amount,
        'description',
          'Restitución del saldo por pagar al conductor',
        'driver_id', new.driver_id,
        'withdrawal_id', new.id,
        'metadata', jsonb_build_object(
          'failure_reason', new.failure_reason,
          'rejection_reason', new.notes,
          'release_status', new.status,
          'accounting_event',
            'withdrawal_reservation_released'
        )
      )
    );

    perform public.post_financial_transaction(
      p_transaction_type =>
        'withdrawal_reservation_released',

      p_description =>
        format(
          case
            when new.status = 'rejected'
              then 'Liberación de reserva del retiro rechazado %s'
            else 'Liberación de reserva del retiro fallido %s'
          end,
          new.id
        ),

      p_entries =>
        v_entries,

      p_currency =>
        'MXN',

      p_idempotency_key =>
        case
          when new.status = 'rejected'
            then 'withdrawal-rejected-release:'
              || new.id::text
              || ':v1'
          else 'withdrawal-failed-release:'
            || new.id::text
            || ':v1'
        end,

      p_withdrawal_id =>
        new.id,

      p_metadata =>
        jsonb_build_object(
          'driver_id', new.driver_id,
          'wallet_id', new.wallet_id,
          'amount', new.amount,
          'failure_reason', new.failure_reason,
          'rejection_reason', new.notes,
          'status', new.status,
          'integration_version', 1
        ),

      p_created_by =>
        coalesce(new.approved_by, auth.uid()),

      p_effective_at =>
        now()
    );
  end if;

  return new;
end;
$function$;



-- ============================================================
-- 6. COMPLETAR RETIRO CON DATOS SPEI
-- ============================================================

create or replace function public.complete_withdrawal_with_spei(
  p_request_id uuid,
  p_transfer_provider text,
  p_provider_reference text,
  p_provider_transfer_id text default null,
  p_spei_tracking_key text default null,
  p_receipt_url text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request public.withdraw_requests%rowtype;
  v_provider text;
  v_provider_reference text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  v_provider :=
    nullif(
      btrim(
        coalesce(p_transfer_provider, '')
      ),
      ''
    );

  v_provider_reference :=
    nullif(
      btrim(
        coalesce(p_provider_reference, '')
      ),
      ''
    );

  if v_provider is null then
    raise exception
      'El proveedor de transferencia es obligatorio';
  end if;

  if v_provider_reference is null then
    raise exception
      'La referencia del proveedor es obligatoria';
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status = 'paid' then
    if v_request.provider_reference
       is distinct from v_provider_reference then
      raise exception
        'El retiro ya fue pagado con otra referencia';
    end if;

    return v_request.id;
  end if;

  if v_request.status not in (
    'pending',
    'approved',
    'processing'
  ) then
    raise exception
      'El retiro no puede pagarse desde el estado: %',
      v_request.status;
  end if;

  update public.withdraw_requests
  set
    transfer_provider = v_provider,

    provider_reference =
      v_provider_reference,

    provider_transfer_id =
      nullif(
        btrim(
          coalesce(
            p_provider_transfer_id,
            ''
          )
        ),
        ''
      ),

    spei_tracking_key =
      nullif(
        btrim(
          coalesce(
            p_spei_tracking_key,
            ''
          )
        ),
        ''
      ),

    receipt_url =
      nullif(
        btrim(
          coalesce(
            p_receipt_url,
            ''
          )
        ),
        ''
      ),

    provider_payload =
      coalesce(
        p_provider_payload,
        '{}'::jsonb
      ),

    reconciliation_status =
      'pending',

    reconciled_at = null,
    reconciled_by = null,
    reconciliation_notes = null,

    updated_at = now()

  where id = v_request.id;

  perform public.complete_withdrawal(
    p_request_id =>
      v_request.id,

    p_provider_reference =>
      v_provider_reference
  );

  return v_request.id;
end;
$function$;


revoke all
on function public.complete_withdrawal_with_spei(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.complete_withdrawal_with_spei(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
to authenticated, service_role;


comment on function public.complete_withdrawal_with_spei(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
)
is
  'Completa un retiro con proveedor, referencia, identificador, clave SPEI, comprobante y payload técnico.';


-- ============================================================
-- 7. CONCILIAR RETIRO PAGADO
-- ============================================================

create or replace function public.reconcile_withdrawal(
  p_request_id uuid,
  p_reconciliation_status text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_request public.withdraw_requests%rowtype;
  v_status text;
begin
  perform public.require_finance_access();

  v_status :=
    lower(
      btrim(
        coalesce(
          p_reconciliation_status,
          ''
        )
      )
    );

  if v_status not in (
    'matched',
    'mismatch',
    'not_required'
  ) then
    raise exception
      'Estado de conciliación inválido: %',
      p_reconciliation_status;
  end if;

  select *
  into v_request
  from public.withdraw_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception
      'Retiro no encontrado';
  end if;

  if v_request.status <> 'paid' then
    raise exception
      'Solo se pueden conciliar retiros pagados';
  end if;

  if v_request.reconciliation_status = v_status
     and v_request.reconciled_at is not null then
    return v_request.id;
  end if;

  if v_status = 'matched'
     and nullif(
       btrim(
         coalesce(
           v_request.provider_reference,
           ''
         )
       ),
       ''
     ) is null then
    raise exception
      'No puede marcarse como conciliado sin referencia del proveedor';
  end if;

  update public.withdraw_requests
  set
    reconciliation_status =
      v_status,

    reconciled_at =
      now(),

    reconciled_by =
      auth.uid(),

    reconciliation_notes =
      nullif(
        btrim(
          coalesce(
            p_notes,
            ''
          )
        ),
        ''
      ),

    updated_at =
      now()

  where id = v_request.id;

  perform public.log_finance_event(
    v_request.driver_id,
    'withdrawal_reconciled',
    'withdraw_request',
    v_request.id,
    v_request.amount,

    jsonb_build_object(
      'reconciliation_status',
        v_status,

      'provider_reference',
        v_request.provider_reference,

      'provider_transfer_id',
        v_request.provider_transfer_id,

      'spei_tracking_key',
        v_request.spei_tracking_key,

      'notes',
        nullif(
          btrim(
            coalesce(
              p_notes,
              ''
            )
          ),
          ''
        ),

      'reconciled_by',
        auth.uid(),

      'integration_version',
        1
    )
  );

  return v_request.id;
end;
$function$;


revoke all
on function public.reconcile_withdrawal(
  uuid,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.reconcile_withdrawal(
  uuid,
  text,
  text
)
to authenticated, service_role;


comment on function public.reconcile_withdrawal(
  uuid,
  text,
  text
)
is
  'Marca un retiro pagado como conciliado, con diferencia o sin conciliación requerida, y registra auditoría financiera.';


-- ============================================================
-- 8. VISTA FINANCIERA DE RETIROS
-- ============================================================

create or replace view public.finance_withdrawals_detailed
with (security_invoker = true)
as
select
  withdrawal.id,
  withdrawal.driver_id,

  profile.full_name as driver_name,

  withdrawal.wallet_id,
  withdrawal.amount,
  withdrawal.status,

  withdrawal.bank_name,
  withdrawal.account_holder,
  withdrawal.clabe,

  withdrawal.transfer_provider,
  withdrawal.provider_reference,
  withdrawal.provider_transfer_id,
  withdrawal.spei_tracking_key,
  withdrawal.receipt_url,

  withdrawal.reconciliation_status,
  withdrawal.reconciled_at,
  withdrawal.reconciled_by,
  withdrawal.reconciliation_notes,

  withdrawal.failure_reason,
  withdrawal.notes,

  withdrawal.requested_at,
  withdrawal.reserved_at,
  withdrawal.approved_at,
  withdrawal.paid_at,

  withdrawal.approved_by,

  withdrawal.provider_payload,

  reserved_transaction.id
    as reserved_financial_transaction_id,

  reserved_transaction.status
    as reserved_financial_transaction_status,

  paid_transaction.id
    as paid_financial_transaction_id,

  paid_transaction.status
    as paid_financial_transaction_status,

  release_transaction.id
    as release_financial_transaction_id,

  release_transaction.status
    as release_financial_transaction_status,

  withdrawal.created_at,
  withdrawal.updated_at

from public.withdraw_requests withdrawal

left join public.profiles profile
  on profile.id = withdrawal.driver_id

left join public.financial_transactions reserved_transaction
  on reserved_transaction.idempotency_key =
    'withdrawal-reserved:'
    || withdrawal.id::text
    || ':v1'

left join public.financial_transactions paid_transaction
  on paid_transaction.idempotency_key =
    'withdrawal-paid:'
    || withdrawal.id::text
    || ':v1'

left join public.financial_transactions release_transaction
  on release_transaction.idempotency_key =
    case
      when withdrawal.status = 'rejected'
        then
          'withdrawal-rejected-release:'
          || withdrawal.id::text
          || ':v1'

      when withdrawal.status = 'failed'
        then
          'withdrawal-failed-release:'
          || withdrawal.id::text
          || ':v1'

      else null
    end;


grant select
on public.finance_withdrawals_detailed
to authenticated;


comment on view public.finance_withdrawals_detailed is
  'Vista financiera de retiros con datos bancarios, SPEI, conciliación y pólizas relacionadas.';


-- ============================================================
-- 9. RESUMEN DE CONCILIACIÓN
-- ============================================================

create or replace view public.finance_withdrawal_reconciliation_summary
with (security_invoker = true)
as
select
  count(*) filter (
    where status = 'paid'
      and reconciliation_status = 'pending'
  )::bigint as pending_reconciliation_count,

  coalesce(
    sum(amount) filter (
      where status = 'paid'
        and reconciliation_status = 'pending'
    ),
    0
  )::numeric(14,2)
    as pending_reconciliation_amount,

  count(*) filter (
    where reconciliation_status = 'matched'
  )::bigint as matched_count,

  coalesce(
    sum(amount) filter (
      where reconciliation_status = 'matched'
    ),
    0
  )::numeric(14,2)
    as matched_amount,

  count(*) filter (
    where reconciliation_status = 'mismatch'
  )::bigint as mismatch_count,

  coalesce(
    sum(amount) filter (
      where reconciliation_status = 'mismatch'
    ),
    0
  )::numeric(14,2)
    as mismatch_amount

from public.withdraw_requests;


grant select
on public.finance_withdrawal_reconciliation_summary
to authenticated;


comment on view
  public.finance_withdrawal_reconciliation_summary
is
  'Resumen de retiros pendientes de conciliación, conciliados y con diferencias.';
