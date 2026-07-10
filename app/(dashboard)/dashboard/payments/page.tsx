export default function PaymentsPage() {
  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Finanzas
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Pagos
        </h1>

        <p className="mt-2 text-gray-600">
          Consulta tus pagos, cargos y métodos de pago.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total pagado</p>
          <p className="mt-3 text-3xl font-bold">$0.00</p>
          <p className="mt-2 text-sm text-gray-400">
            Sin pagos registrados
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Pagos pendientes</p>
          <p className="mt-3 text-3xl font-bold">$0.00</p>
          <p className="mt-2 text-sm text-gray-400">
            No tienes pagos pendientes
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Métodos de pago</p>
          <p className="mt-3 text-3xl font-bold">0</p>
          <p className="mt-2 text-sm text-gray-400">
            Agrega una tarjeta más adelante
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Historial de pagos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Aquí aparecerán los pagos de tus viajes.
            </p>
          </div>

          <button className="rounded-lg bg-black px-4 py-2 font-semibold text-white">
            Agregar método
          </button>
        </div>

        <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
          <div className="text-center">
            <p className="font-semibold text-gray-700">
              No hay pagos registrados
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Tus movimientos aparecerán en esta sección.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
