-- ============================================================
-- AXI: REEMBOLSOS AL MÉTODO ORIGINAL
-- ============================================================

-- ============================================================
-- 1. CAMPOS DE DESTINO, PROVEEDOR Y CONCILIACIÓN
-- ============================================================

alter table public.refund_requests
  add column if not exists refund_destination text
    not null default 'passenger_wallet',

  add column if not exists provider_status text
    not null default 'not_required',

  add column if not exists payment_transaction_id uuid null
    references public.payment_transactions(id)
    on delete set null,

  add column if not exists provider text null,

  add column if not exists provider_reference text null,

  add column if not exists provider_refund_id text null,

  add column if not exists external_refund_amount numeric(12,2)
    not null default 0,

  add column if not exists completed_refund_amount numeric(12,2)
    not null default 0,

  add column if not exists processing_at timestamptz null,

  add column if not exists completed_at timestamptz null,

  add column if not exists failed_at timestamptz null,

  add column if not exists cancelled_at timestamptz null,

  add column if not exists failure_reason text null,

  add column if not exists cancellation_reason text null,

  add column if not exists provider_payload jsonb
    not null default '{}'::jsonb,

  add column if not exists financial_transaction_id uuid null
    references public.financial_transactions(id)
    on delete set null,

  add column if not exists reversal_financial_transaction_id uuid null
    references public.financial_transactions(id)
    on delete set null,

  add column if not exists reconciliation_status text
    not null default 'not_required',

  add column if not exists reconciled_at timestamptz null,

  add column if not exists reconciled_by uuid null
    references public.profiles(id)
    on delete set null,

  add column if not exists reconciliation_notes text null;


-- ============================================================
-- 2. ESTADOS GENERALES DE LA SOLICITUD
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_status_check;

alter table public.refund_requests
  add constraint
    refund_requests_status_check
  check (
    status in (
      'pending',
      'processing',
      'approved',
      'completed',
      'failed',
      'rejected',
      'cancelled'
    )
  );


-- ============================================================
-- 3. DESTINO DEL REEMBOLSO
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_destination_check;

alter table public.refund_requests
  add constraint
    refund_requests_destination_check
  check (
    refund_destination in (
      'passenger_wallet',
      'original_payment'
    )
  );


-- ============================================================
-- 4. ESTADO DEL PROVEEDOR
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_provider_status_check;

alter table public.refund_requests
  add constraint
    refund_requests_provider_status_check
  check (
    provider_status in (
      'not_required',
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  );


-- ============================================================
-- 5. ESTADO DE CONCILIACIÓN
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_reconciliation_status_check;

alter table public.refund_requests
  add constraint
    refund_requests_reconciliation_status_check
  check (
    reconciliation_status in (
      'not_required',
      'pending',
      'matched',
      'mismatch'
    )
  );


-- ============================================================
-- 6. VALIDACIONES DE MONTOS
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_external_refund_amount_check;

alter table public.refund_requests
  add constraint
    refund_requests_external_refund_amount_check
  check (
    external_refund_amount >= 0
  );


alter table public.refund_requests
  drop constraint if exists
    refund_requests_completed_refund_amount_check;

alter table public.refund_requests
  add constraint
    refund_requests_completed_refund_amount_check
  check (
    completed_refund_amount >= 0
    and completed_refund_amount <= amount
  );


-- ============================================================
-- 7. COHERENCIA ENTRE DESTINO Y PROVEEDOR
-- ============================================================

alter table public.refund_requests
  drop constraint if exists
    refund_requests_destination_provider_check;

alter table public.refund_requests
  add constraint
    refund_requests_destination_provider_check
  check (
    (
      refund_destination = 'passenger_wallet'
      and provider_status = 'not_required'
      and external_refund_amount = 0
    )
    or
    (
      refund_destination = 'original_payment'
      and provider_status <> 'not_required'
      and external_refund_amount > 0
    )
  );


-- ============================================================
-- 8. ÍNDICES
-- ============================================================

create index if not exists
  refund_requests_destination_status_idx
on public.refund_requests (
  refund_destination,
  status,
  requested_at desc
);


create index if not exists
  refund_requests_provider_status_idx
on public.refund_requests (
  provider_status,
  requested_at desc
);


create index if not exists
  refund_requests_payment_transaction_idx
on public.refund_requests (
  payment_transaction_id
)
where payment_transaction_id is not null;


create index if not exists
  refund_requests_provider_reference_idx
on public.refund_requests (
  provider,
  provider_reference
)
where provider_reference is not null;


create unique index if not exists
  refund_requests_provider_refund_unique
on public.refund_requests (
  provider,
  provider_refund_id
)
where provider_refund_id is not null;


create index if not exists
  refund_requests_reconciliation_idx
on public.refund_requests (
  reconciliation_status,
  completed_at desc
);


-- ============================================================
-- 9. COMENTARIOS
-- ============================================================

comment on column
  public.refund_requests.refund_destination
is
  'Destino del reembolso: saldo interno del pasajero o método de pago original.';


comment on column
  public.refund_requests.provider_status
is
  'Estado operativo del reembolso ante el proveedor de pagos.';


comment on column
  public.refund_requests.external_refund_amount
is
  'Monto solicitado al proveedor para devolver al método original.';


comment on column
  public.refund_requests.completed_refund_amount
is
  'Monto confirmado como reembolsado por el proveedor.';


comment on column
  public.refund_requests.financial_transaction_id
is
  'Póliza contable asociada al reembolso externo completado.';


comment on column
  public.refund_requests.reversal_financial_transaction_id
is
  'Póliza inversa asociada a una reversa o fallo posterior del reembolso.';


-- ============================================================
-- 10. INICIAR REEMBOLSO AL MÉTODO ORIGINAL
-- ============================================================

create or replace function public.start_original_payment_refund(
  p_refund_id uuid,
  p_provider text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
  v_payment public.payment_transactions%rowtype;

  v_provider text;

  v_committed_total_refunds numeric(12,2);
  v_committed_external_refunds numeric(12,2);

  v_total_refundable numeric(12,2);
  v_external_refundable numeric(12,2);
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  v_provider :=
    nullif(
      lower(
        btrim(
          coalesce(p_provider, '')
        )
      ),
      ''
    );

  if v_provider is null then
    raise exception
      'El proveedor de pagos es obligatorio';
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.status = 'processing'
     and v_refund.refund_destination = 'original_payment' then
    return v_refund.id;
  end if;

  if v_refund.status <> 'pending' then
    raise exception
      'La solicitud no puede procesarse desde el estado: %',
      v_refund.status;
  end if;

  if v_refund.trip_id is null then
    raise exception
      'El reembolso debe estar vinculado a un viaje';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where trip_id = v_refund.trip_id
  for update;

  if not found then
    raise exception
      'No existe un pago vinculado al viaje';
  end if;

  if v_payment.status <> 'paid' then
    raise exception
      'El pago no está confirmado como pagado';
  end if;

  if v_payment.method not in (
    'card',
    'mercado_pago'
  ) then
    raise exception
      'El método de pago no admite reembolso al proveedor';
  end if;

  if nullif(
    btrim(
      coalesce(
        v_payment.provider_payment_id,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'El pago no tiene referencia del proveedor';
  end if;

  if round(
    coalesce(v_payment.external_amount, 0),
    2
  ) <= 0 then
    raise exception
      'El pago no contiene importe externo reembolsable';
  end if;

  if v_refund.passenger_id is not null
     and v_refund.passenger_id
       <> v_payment.passenger_id then
    raise exception
      'El pasajero de la solicitud no coincide con el pago';
  end if;

  select
    coalesce(
      sum(amount),
      0
    )::numeric(12,2)
  into v_committed_total_refunds
  from public.refund_requests
  where trip_id = v_refund.trip_id
    and id <> v_refund.id
    and status in (
      'approved',
      'processing',
      'completed'
    );

  select
    coalesce(
      sum(external_refund_amount),
      0
    )::numeric(12,2)
  into v_committed_external_refunds
  from public.refund_requests
  where payment_transaction_id = v_payment.id
    and id <> v_refund.id
    and refund_destination = 'original_payment'
    and status in (
      'processing',
      'completed'
    );

  v_total_refundable :=
    round(
      greatest(
        coalesce(v_payment.total_amount, 0)
        - v_committed_total_refunds,
        0
      ),
      2
    );

  v_external_refundable :=
    round(
      greatest(
        coalesce(v_payment.external_amount, 0)
        - v_committed_external_refunds,
        0
      ),
      2
    );

  if v_refund.amount > v_total_refundable then
    raise exception
      'El monto excede el saldo total reembolsable. Disponible: %',
      v_total_refundable;
  end if;

  if v_refund.amount > v_external_refundable then
    raise exception
      'El monto excede lo pagado externamente. Disponible: %',
      v_external_refundable;
  end if;

  update public.refund_requests
  set
    passenger_id =
      v_payment.passenger_id,

    refund_destination =
      'original_payment',

    provider_status =
      'processing',

    payment_transaction_id =
      v_payment.id,

    provider =
      v_provider,

    external_refund_amount =
      round(v_refund.amount, 2),

    completed_refund_amount =
      0,

    status =
      'processing',

    processing_at =
      now(),

    completed_at =
      null,

    failed_at =
      null,

    cancelled_at =
      null,

    failure_reason =
      null,

    cancellation_reason =
      null,

    provider_reference =
      null,

    provider_refund_id =
      null,

    provider_payload =
      '{}'::jsonb,

    reconciliation_status =
      'pending',

    reconciled_at =
      null,

    reconciled_by =
      null,

    reconciliation_notes =
      null,

    updated_at =
      now()

  where id = v_refund.id;

  perform public.log_finance_event(
    'original_payment_refund_started',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_refund.trip_id,

      'payment_transaction_id',
        v_payment.id,

      'passenger_id',
        v_payment.passenger_id,

      'provider',
        v_provider,

      'provider_payment_id',
        v_payment.provider_payment_id,

      'requested_amount',
        v_refund.amount,

      'total_refundable_before',
        v_total_refundable,

      'external_refundable_before',
        v_external_refundable,

      'integration_version',
        1
    )
  );

  return v_refund.id;
end;
$function$;


revoke all
on function public.start_original_payment_refund(
  uuid,
  text
)
from public, anon, authenticated;


grant execute
on function public.start_original_payment_refund(
  uuid,
  text
)
to authenticated, service_role;


comment on function public.start_original_payment_refund(
  uuid,
  text
)
is
  'Inicia un reembolso parcial o total al método original, validando el pago digital, el total del viaje y el importe realmente pagado externamente.';


-- ============================================================
-- 11. CONFIRMAR REEMBOLSO DEL PROVEEDOR
-- ============================================================

create or replace function public.complete_original_payment_refund(
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_refund_id text,
  p_completed_amount numeric,
  p_provider_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
  v_payment public.payment_transactions%rowtype;

  v_refund_expense_account uuid;
  v_provider_clearing_account uuid;

  v_provider_reference text;
  v_provider_refund_id text;
  v_completed_amount numeric(12,2);

  v_already_completed_external numeric(12,2);
  v_payment_remaining_external numeric(12,2);

  v_financial_transaction_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  v_provider_reference :=
    nullif(
      btrim(
        coalesce(
          p_provider_reference,
          ''
        )
      ),
      ''
    );

  v_provider_refund_id :=
    nullif(
      btrim(
        coalesce(
          p_provider_refund_id,
          ''
        )
      ),
      ''
    );

  v_completed_amount :=
    round(
      coalesce(
        p_completed_amount,
        0
      ),
      2
    );

  if v_provider_reference is null then
    raise exception
      'La referencia del proveedor es obligatoria';
  end if;

  if v_provider_refund_id is null then
    raise exception
      'El identificador del reembolso del proveedor es obligatorio';
  end if;

  if v_completed_amount <= 0 then
    raise exception
      'El monto confirmado debe ser mayor que cero';
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.status = 'completed'
     and v_refund.provider_status = 'completed' then

    if v_refund.provider_reference
       is distinct from v_provider_reference
       or v_refund.provider_refund_id
       is distinct from v_provider_refund_id
       or round(
            coalesce(
              v_refund.completed_refund_amount,
              0
            ),
            2
          )
          <> v_completed_amount then
      raise exception
        'El reembolso ya fue completado con datos distintos';
    end if;

    return v_refund.id;
  end if;

  if v_refund.status <> 'processing'
     or v_refund.provider_status <> 'processing'
     or v_refund.refund_destination <> 'original_payment' then
    raise exception
      'El reembolso no está en procesamiento externo';
  end if;

  if v_completed_amount
     > round(
         coalesce(
           v_refund.external_refund_amount,
           0
         ),
         2
       ) then
    raise exception
      'El monto confirmado supera el monto solicitado al proveedor';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = v_refund.payment_transaction_id
  for update;

  if not found then
    raise exception
      'No existe el pago vinculado al reembolso';
  end if;

  select
    coalesce(
      sum(completed_refund_amount),
      0
    )::numeric(12,2)
  into v_already_completed_external
  from public.refund_requests
  where payment_transaction_id = v_payment.id
    and id <> v_refund.id
    and refund_destination = 'original_payment'
    and status = 'completed'
    and provider_status = 'completed';

  v_payment_remaining_external :=
    round(
      greatest(
        coalesce(v_payment.external_amount, 0)
        - v_already_completed_external,
        0
      ),
      2
    );

  if v_completed_amount
     > v_payment_remaining_external then
    raise exception
      'El monto confirmado excede el saldo externo restante. Disponible: %',
      v_payment_remaining_external;
  end if;

  select id
  into v_refund_expense_account
  from public.financial_accounts
  where code = 'expense.refunds'
    and status = 'active';

  select id
  into v_provider_clearing_account
  from public.financial_accounts
  where code = 'asset.provider_clearing'
    and status = 'active';

  if v_refund_expense_account is null
     or v_provider_clearing_account is null then
    raise exception
      'Faltan cuentas contables para registrar el reembolso';
  end if;

  v_financial_transaction_id :=
    public.post_financial_transaction(
      p_transaction_type =>
        'original_payment_refund',

      p_description =>
        format(
          'Reembolso al método original por $%s',
          v_completed_amount
        ),

      p_entries =>
        jsonb_build_array(
          jsonb_build_object(
            'account_id',
              v_refund_expense_account,

            'direction',
              'debit',

            'amount',
              v_completed_amount,

            'description',
              'Gasto por reembolso al método original',

            'passenger_id',
              v_payment.passenger_id,

            'trip_id',
              v_payment.trip_id,

            'payment_id',
              v_payment.id,

            'refund_id',
              v_refund.id
          ),

          jsonb_build_object(
            'account_id',
              v_provider_clearing_account,

            'direction',
              'credit',

            'amount',
              v_completed_amount,

            'description',
              'Salida de fondos del proveedor por reembolso',

            'passenger_id',
              v_payment.passenger_id,

            'trip_id',
              v_payment.trip_id,

            'payment_id',
              v_payment.id,

            'refund_id',
              v_refund.id
          )
        ),

      p_currency =>
        'MXN',

      p_idempotency_key =>
        'original-payment-refund:'
        || v_refund.id::text
        || ':v1',

      p_trip_id =>
        v_payment.trip_id,

      p_payment_id =>
        v_payment.id,

      p_refund_id =>
        v_refund.id,

      p_provider =>
        v_refund.provider,

      p_provider_reference =>
        v_provider_reference,

      p_metadata =>
        jsonb_build_object(
          'provider_refund_id',
            v_provider_refund_id,

          'requested_amount',
            v_refund.external_refund_amount,

          'completed_amount',
            v_completed_amount,

          'provider_payload',
            coalesce(
              p_provider_payload,
              '{}'::jsonb
            ),

          'integration_version',
            1
        ),

      p_created_by =>
        auth.uid(),

      p_effective_at =>
        now()
    );

  update public.refund_requests
  set
    status =
      'completed',

    provider_status =
      'completed',

    provider_reference =
      v_provider_reference,

    provider_refund_id =
      v_provider_refund_id,

    completed_refund_amount =
      v_completed_amount,

    provider_payload =
      coalesce(
        p_provider_payload,
        '{}'::jsonb
      ),

    completed_at =
      now(),

    approved_at =
      coalesce(
        approved_at,
        now()
      ),

    approved_by =
      coalesce(
        approved_by,
        auth.uid()
      ),

    financial_transaction_id =
      v_financial_transaction_id,

    reconciliation_status =
      'pending',

    failure_reason =
      null,

    failed_at =
      null,

    cancellation_reason =
      null,

    cancelled_at =
      null,

    updated_at =
      now()

  where id = v_refund.id;

  update public.payment_transactions
  set
    refunded_at =
      case
        when round(
          v_already_completed_external
          + v_completed_amount,
          2
        ) >= round(
          coalesce(
            external_amount,
            0
          ),
          2
        )
          then coalesce(
            refunded_at,
            now()
          )
        else refunded_at
      end,

    updated_at =
      now()

  where id = v_payment.id;

  perform public.log_finance_event(
    'original_payment_refund_completed',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_payment.trip_id,

      'payment_transaction_id',
        v_payment.id,

      'passenger_id',
        v_payment.passenger_id,

      'provider',
        v_refund.provider,

      'provider_reference',
        v_provider_reference,

      'provider_refund_id',
        v_provider_refund_id,

      'requested_amount',
        v_refund.external_refund_amount,

      'completed_amount',
        v_completed_amount,

      'financial_transaction_id',
        v_financial_transaction_id,

      'remaining_external_after',
        round(
          greatest(
            v_payment_remaining_external
            - v_completed_amount,
            0
          ),
          2
        ),

      'integration_version',
        1
    )
  );

  return v_refund.id;
end;
$function$;


revoke all
on function public.complete_original_payment_refund(
  uuid,
  text,
  text,
  numeric,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.complete_original_payment_refund(
  uuid,
  text,
  text,
  numeric,
  jsonb
)
to authenticated, service_role;


comment on function public.complete_original_payment_refund(
  uuid,
  text,
  text,
  numeric,
  jsonb
)
is
  'Confirma un reembolso al método original, guarda la referencia del proveedor, publica la póliza y controla el saldo externo acumulado.';


-- ============================================================
-- 12. MARCAR REEMBOLSO EXTERNO COMO FALLIDO
-- ============================================================

create or replace function public.fail_original_payment_refund(
  p_refund_id uuid,
  p_failure_reason text,
  p_provider_reference text default null,
  p_provider_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
  v_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_axi_finance() then
    raise exception
      'No autorizado';
  end if;

  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_failure_reason,
          ''
        )
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo del fallo es obligatorio';
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.status = 'failed'
     and v_refund.provider_status = 'failed' then
    return v_refund.id;
  end if;

  if v_refund.status <> 'processing'
     or v_refund.provider_status <> 'processing'
     or v_refund.refund_destination <> 'original_payment' then
    raise exception
      'El reembolso no está en procesamiento externo';
  end if;

  update public.refund_requests
  set
    status =
      'failed',

    provider_status =
      'failed',

    provider_reference =
      coalesce(
        nullif(
          btrim(
            coalesce(
              p_provider_reference,
              ''
            )
          ),
          ''
        ),
        provider_reference
      ),

    provider_payload =
      coalesce(
        p_provider_payload,
        '{}'::jsonb
      ),

    failure_reason =
      v_reason,

    failed_at =
      now(),

    reconciliation_status =
      'not_required',

    reconciled_at =
      null,

    reconciled_by =
      null,

    reconciliation_notes =
      null,

    updated_at =
      now()

  where id = v_refund.id;

  perform public.log_finance_event(
    'original_payment_refund_failed',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_refund.trip_id,

      'payment_transaction_id',
        v_refund.payment_transaction_id,

      'provider',
        v_refund.provider,

      'provider_reference',
        p_provider_reference,

      'requested_amount',
        v_refund.external_refund_amount,

      'failure_reason',
        v_reason,

      'integration_version',
        1
    )
  );

  return v_refund.id;
end;
$function$;


-- ============================================================
-- 13. CANCELAR REEMBOLSO EXTERNO ANTES DE COMPLETARSE
-- ============================================================

create or replace function public.cancel_original_payment_refund(
  p_refund_id uuid,
  p_cancellation_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
  v_reason text;
begin
  perform public.require_finance_access();

  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_cancellation_reason,
          ''
        )
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo de cancelación es obligatorio';
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.status = 'cancelled'
     and v_refund.provider_status = 'cancelled' then
    return v_refund.id;
  end if;

  if v_refund.status <> 'processing'
     or v_refund.provider_status <> 'processing'
     or v_refund.refund_destination <> 'original_payment' then
    raise exception
      'El reembolso no puede cancelarse desde su estado actual';
  end if;

  update public.refund_requests
  set
    status =
      'cancelled',

    provider_status =
      'cancelled',

    cancellation_reason =
      v_reason,

    cancelled_at =
      now(),

    reconciliation_status =
      'not_required',

    reconciled_at =
      null,

    reconciled_by =
      null,

    reconciliation_notes =
      null,

    updated_at =
      now()

  where id = v_refund.id;

  perform public.log_finance_event(
    'original_payment_refund_cancelled',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_refund.trip_id,

      'payment_transaction_id',
        v_refund.payment_transaction_id,

      'provider',
        v_refund.provider,

      'requested_amount',
        v_refund.external_refund_amount,

      'cancellation_reason',
        v_reason,

      'integration_version',
        1
    )
  );

  return v_refund.id;
end;
$function$;


-- ============================================================
-- 14. REVERSAR REEMBOLSO EXTERNO COMPLETADO
-- ============================================================

create or replace function public.reverse_original_payment_refund(
  p_refund_id uuid,
  p_reversal_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
  v_payment public.payment_transactions%rowtype;

  v_reason text;
  v_reversal_transaction_id uuid;
  v_remaining_completed numeric(12,2);
begin
  perform public.require_finance_access();

  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reversal_reason,
          ''
        )
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'El motivo de reversa es obligatorio';
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.reversal_financial_transaction_id is not null then
    return v_refund.id;
  end if;

  if v_refund.status <> 'completed'
     or v_refund.provider_status <> 'completed'
     or v_refund.refund_destination <> 'original_payment'
     or v_refund.financial_transaction_id is null then
    raise exception
      'Solo pueden reversarse reembolsos externos completados';
  end if;

  select *
  into v_payment
  from public.payment_transactions
  where id = v_refund.payment_transaction_id
  for update;

  if not found then
    raise exception
      'No existe el pago vinculado al reembolso';
  end if;

  v_reversal_transaction_id :=
    public.reverse_financial_transaction(
      p_transaction_id =>
        v_refund.financial_transaction_id,

      p_reason =>
        v_reason,

      p_idempotency_key =>
        'original-payment-refund-reversal:'
        || v_refund.id::text
        || ':v1',

      p_created_by =>
        auth.uid()
    );

  update public.refund_requests
  set
    status =
      'cancelled',

    provider_status =
      'cancelled',

    cancellation_reason =
      v_reason,

    cancelled_at =
      now(),

    reversal_financial_transaction_id =
      v_reversal_transaction_id,

    reconciliation_status =
      'not_required',

    reconciled_at =
      null,

    reconciled_by =
      null,

    reconciliation_notes =
      null,

    updated_at =
      now()

  where id = v_refund.id;

  select
    coalesce(
      sum(completed_refund_amount),
      0
    )::numeric(12,2)
  into v_remaining_completed
  from public.refund_requests
  where payment_transaction_id = v_payment.id
    and id <> v_refund.id
    and refund_destination = 'original_payment'
    and status = 'completed'
    and provider_status = 'completed';

  update public.payment_transactions
  set
    refunded_at =
      case
        when round(
          v_remaining_completed,
          2
        ) < round(
          coalesce(
            external_amount,
            0
          ),
          2
        )
          then null
        else refunded_at
      end,

    updated_at =
      now()

  where id = v_payment.id;

  perform public.log_finance_event(
    'original_payment_refund_reversed',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_refund.trip_id,

      'payment_transaction_id',
        v_payment.id,

      'provider',
        v_refund.provider,

      'provider_reference',
        v_refund.provider_reference,

      'provider_refund_id',
        v_refund.provider_refund_id,

      'completed_amount',
        v_refund.completed_refund_amount,

      'financial_transaction_id',
        v_refund.financial_transaction_id,

      'reversal_financial_transaction_id',
        v_reversal_transaction_id,

      'reversal_reason',
        v_reason,

      'integration_version',
        1
    )
  );

  return v_refund.id;
end;
$function$;


-- ============================================================
-- 15. PERMISOS
-- ============================================================

revoke all
on function public.fail_original_payment_refund(
  uuid,
  text,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function public.fail_original_payment_refund(
  uuid,
  text,
  text,
  jsonb
)
to authenticated, service_role;


revoke all
on function public.cancel_original_payment_refund(
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.cancel_original_payment_refund(
  uuid,
  text
)
to authenticated, service_role;


revoke all
on function public.reverse_original_payment_refund(
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.reverse_original_payment_refund(
  uuid,
  text
)
to authenticated, service_role;


comment on function public.fail_original_payment_refund(
  uuid,
  text,
  text,
  jsonb
)
is
  'Marca como fallido un reembolso externo que todavía estaba en procesamiento.';


comment on function public.cancel_original_payment_refund(
  uuid,
  text
)
is
  'Cancela un reembolso externo antes de que el proveedor lo complete.';


comment on function public.reverse_original_payment_refund(
  uuid,
  text
)
is
  'Revierte contablemente un reembolso externo completado y restablece su impacto financiero.';


-- ============================================================
-- 16. CONCILIAR REEMBOLSO EXTERNO
-- ============================================================

create or replace function public.reconcile_original_payment_refund(
  p_refund_id uuid,
  p_reconciliation_status text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_refund public.refund_requests%rowtype;
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
    'mismatch'
  ) then
    raise exception
      'Estado de conciliación inválido: %',
      p_reconciliation_status;
  end if;

  select *
  into v_refund
  from public.refund_requests
  where id = p_refund_id
  for update;

  if not found then
    raise exception
      'Solicitud de reembolso no encontrada';
  end if;

  if v_refund.status <> 'completed'
     or v_refund.provider_status <> 'completed'
     or v_refund.refund_destination <> 'original_payment' then
    raise exception
      'Solo pueden conciliarse reembolsos externos completados';
  end if;

  if v_refund.provider_reference is null
     or v_refund.provider_refund_id is null then
    raise exception
      'Faltan referencias del proveedor para conciliar';
  end if;

  if v_refund.reconciliation_status = v_status
     and v_refund.reconciled_at is not null then
    return v_refund.id;
  end if;

  update public.refund_requests
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

  where id = v_refund.id;

  perform public.log_finance_event(
    'original_payment_refund_reconciled',
    v_refund.id::text,

    jsonb_build_object(
      'trip_id',
        v_refund.trip_id,

      'payment_transaction_id',
        v_refund.payment_transaction_id,

      'provider',
        v_refund.provider,

      'provider_reference',
        v_refund.provider_reference,

      'provider_refund_id',
        v_refund.provider_refund_id,

      'completed_amount',
        v_refund.completed_refund_amount,

      'reconciliation_status',
        v_status,

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

  return v_refund.id;
end;
$function$;


revoke all
on function public.reconcile_original_payment_refund(
  uuid,
  text,
  text
)
from public, anon, authenticated;


grant execute
on function public.reconcile_original_payment_refund(
  uuid,
  text,
  text
)
to authenticated, service_role;


comment on function public.reconcile_original_payment_refund(
  uuid,
  text,
  text
)
is
  'Concilia un reembolso externo completado contra la información del proveedor.';


-- ============================================================
-- 17. VISTA DETALLADA DE REEMBOLSOS
-- ============================================================

create or replace view public.finance_refunds_detailed
with (security_invoker = true)
as
select
  refund.id,
  refund.trip_id,
  refund.passenger_id,

  profile.full_name as passenger_name,

  refund.amount,
  refund.reason,
  refund.notes,
  refund.status,

  refund.refund_destination,

  refund.payment_transaction_id,

  payment.method as payment_method,
  payment.status as payment_status,
  payment.total_amount as payment_total_amount,
  payment.passenger_wallet_applied,
  payment.external_amount,
  payment.provider_payment_id,

  refund.provider,
  refund.provider_status,
  refund.provider_reference,
  refund.provider_refund_id,

  refund.external_refund_amount,
  refund.completed_refund_amount,

  refund.processing_at,
  refund.completed_at,
  refund.failed_at,
  refund.cancelled_at,

  refund.failure_reason,
  refund.cancellation_reason,

  refund.wallet_transaction_id,
  refund.credited_at,

  refund.financial_transaction_id,
  financial_transaction.status
    as financial_transaction_status,

  refund.reversal_financial_transaction_id,
  reversal_transaction.status
    as reversal_financial_transaction_status,

  refund.reconciliation_status,
  refund.reconciled_at,
  refund.reconciled_by,
  refund.reconciliation_notes,

  refund.provider_payload,

  refund.requested_at,
  refund.approved_at,
  refund.approved_by,
  refund.rejected_at,
  refund.rejected_by,

  refund.created_at,
  refund.updated_at

from public.refund_requests refund

left join public.profiles profile
  on profile.id = refund.passenger_id

left join public.payment_transactions payment
  on payment.id = refund.payment_transaction_id

left join public.financial_transactions financial_transaction
  on financial_transaction.id =
    refund.financial_transaction_id

left join public.financial_transactions reversal_transaction
  on reversal_transaction.id =
    refund.reversal_financial_transaction_id;


grant select
on public.finance_refunds_detailed
to authenticated;


comment on view public.finance_refunds_detailed is
  'Vista financiera de reembolsos internos y externos con pago, proveedor, conciliación y pólizas relacionadas.';


-- ============================================================
-- 18. RESUMEN DE REEMBOLSOS EXTERNOS
-- ============================================================

create or replace view public.finance_original_payment_refund_summary
with (security_invoker = true)
as
select
  count(*) filter (
    where refund_destination = 'original_payment'
      and status = 'processing'
  )::bigint as processing_count,

  coalesce(
    sum(external_refund_amount) filter (
      where refund_destination = 'original_payment'
        and status = 'processing'
    ),
    0
  )::numeric(14,2)
    as processing_amount,

  count(*) filter (
    where refund_destination = 'original_payment'
      and status = 'completed'
  )::bigint as completed_count,

  coalesce(
    sum(completed_refund_amount) filter (
      where refund_destination = 'original_payment'
        and status = 'completed'
    ),
    0
  )::numeric(14,2)
    as completed_amount,

  count(*) filter (
    where refund_destination = 'original_payment'
      and status = 'failed'
  )::bigint as failed_count,

  coalesce(
    sum(external_refund_amount) filter (
      where refund_destination = 'original_payment'
        and status = 'failed'
    ),
    0
  )::numeric(14,2)
    as failed_amount,

  count(*) filter (
    where refund_destination = 'original_payment'
      and status = 'cancelled'
  )::bigint as cancelled_count,

  coalesce(
    sum(external_refund_amount) filter (
      where refund_destination = 'original_payment'
        and status = 'cancelled'
    ),
    0
  )::numeric(14,2)
    as cancelled_amount,

  count(*) filter (
    where refund_destination = 'original_payment'
      and status = 'completed'
      and reconciliation_status = 'pending'
  )::bigint as pending_reconciliation_count,

  coalesce(
    sum(completed_refund_amount) filter (
      where refund_destination = 'original_payment'
        and status = 'completed'
        and reconciliation_status = 'pending'
    ),
    0
  )::numeric(14,2)
    as pending_reconciliation_amount,

  count(*) filter (
    where refund_destination = 'original_payment'
      and reconciliation_status = 'mismatch'
  )::bigint as mismatch_count,

  coalesce(
    sum(completed_refund_amount) filter (
      where refund_destination = 'original_payment'
        and reconciliation_status = 'mismatch'
    ),
    0
  )::numeric(14,2)
    as mismatch_amount

from public.refund_requests;


grant select
on public.finance_original_payment_refund_summary
to authenticated;


comment on view
  public.finance_original_payment_refund_summary
is
  'Resumen de procesamiento, finalización, fallo, cancelación y conciliación de reembolsos al método original.';
