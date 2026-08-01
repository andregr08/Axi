begin;

-- ============================================================
-- AXI FINANCE QUERY INDEXES
-- Optimización para Journal, General Ledger y conciliación.
--
-- Esta migración es aditiva:
-- - no elimina datos;
-- - no modifica columnas;
-- - no reemplaza índices existentes;
-- - puede ejecutarse nuevamente gracias a IF NOT EXISTS.
-- ============================================================

create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 1. ORDENAMIENTO Y RANGOS DE FECHA
-- Utilizado por:
-- - Libro diario
-- - Libro mayor
-- - exportaciones financieras
-- ------------------------------------------------------------

create index if not exists
  financial_transactions_effective_at_idx
on public.financial_transactions (
  effective_at desc
);

-- ------------------------------------------------------------
-- 2. ESTADO + FECHA
-- Utilizado por Journal:
-- status = posted/reversed/pending
-- y rango de effective_at.
-- ------------------------------------------------------------

create index if not exists
  financial_transactions_status_effective_at_idx
on public.financial_transactions (
  status,
  effective_at desc
);

-- ------------------------------------------------------------
-- 3. TRANSACCIONES PUBLICADAS
-- Índice parcial para reportes contables normales.
-- Reduce el índice al excluir draft, pending, failed, etc.
-- ------------------------------------------------------------

create index if not exists
  financial_transactions_posted_effective_at_idx
on public.financial_transactions (
  effective_at desc
)
where status = 'posted';

-- ------------------------------------------------------------
-- 4. REVERSAS
-- PostgreSQL no crea automáticamente un índice en la columna
-- que referencia una foreign key.
--
-- Utilizado por:
-- - búsqueda de reversas;
-- - conciliación;
-- - validación de transacciones ya revertidas.
-- ------------------------------------------------------------

create index if not exists
  financial_transactions_reversal_idx
on public.financial_transactions (
  reversal_of_transaction_id
)
where reversal_of_transaction_id is not null;

-- ------------------------------------------------------------
-- 5. BÚSQUEDA TEXTUAL DEL JOURNAL
-- Compatible con búsquedas ILIKE '%texto%'.
-- ------------------------------------------------------------

create index if not exists
  financial_transactions_ledger_folio_trgm_idx
on public.financial_transactions
using gin (
  ledger_folio gin_trgm_ops
);

create index if not exists
  financial_transactions_type_trgm_idx
on public.financial_transactions
using gin (
  transaction_type gin_trgm_ops
);

create index if not exists
  financial_transactions_description_trgm_idx
on public.financial_transactions
using gin (
  description gin_trgm_ops
)
where description is not null;

create index if not exists
  financial_transactions_provider_reference_trgm_idx
on public.financial_transactions
using gin (
  provider_reference gin_trgm_ops
)
where provider_reference is not null;

-- ------------------------------------------------------------
-- 6. BÚSQUEDA TEXTUAL DEL CATÁLOGO DE CUENTAS
-- Utilizado por General Ledger y Accounts.
-- ------------------------------------------------------------

create index if not exists
  financial_accounts_code_trgm_idx
on public.financial_accounts
using gin (
  code gin_trgm_ops
);

create index if not exists
  financial_accounts_name_trgm_idx
on public.financial_accounts
using gin (
  name gin_trgm_ops
);

-- ------------------------------------------------------------
-- 7. ASIENTOS POR CUENTA Y TRANSACCIÓN
--
-- La restricción UNIQUE(transaction_id, entry_number) ya crea
-- un índice compuesto automáticamente, por lo que no se duplica.
--
-- ledger_entries_account_idx también existe y ya cubre:
-- account_id + created_at DESC.
-- ------------------------------------------------------------

analyze public.financial_accounts;
analyze public.financial_transactions;
analyze public.financial_ledger_entries;

commit;
