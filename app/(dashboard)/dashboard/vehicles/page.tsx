export default function VehiclesPage() {
  return (
    <section>
      <div className="mb-8">
        <p className="mb-1 text-sm font-medium text-gray-500">
          Gestión de vehículos
        </p>

        <h1 className="text-3xl font-bold text-gray-900">
          Vehículos
        </h1>

        <p className="mt-2 text-gray-600">
          Registra y administra los vehículos vinculados a tu cuenta.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Vehículos registrados</p>
          <p className="mt-3 text-3xl font-bold">0</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Vehículos activos</p>
          <p className="mt-3 text-3xl font-bold">0</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Documentos pendientes</p>
          <p className="mt-3 text-3xl font-bold">0</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Mis vehículos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Aquí aparecerán los vehículos registrados.
            </p>
          </div>

          <button className="rounded-lg bg-black px-4 py-2 font-semibold text-white">
            Agregar vehículo
          </button>
        </div>

        <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
          <div className="text-center">
            <p className="font-semibold text-gray-700">
              No hay vehículos registrados
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Agrega tu primer vehículo para comenzar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
