import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <h1 className="text-6xl font-bold text-yellow-400">AXI</h1>

      <p className="mt-4 text-center text-xl text-gray-300">
        Plataforma Inteligente para Taxis
      </p>

      <div className="mt-10 flex w-full max-w-md flex-col gap-4 sm:flex-row sm:max-w-none sm:justify-center">
        <Link
          href="/pasajero"
          className="rounded-xl bg-yellow-400 px-6 py-3 text-center font-semibold text-black transition hover:bg-yellow-300"
        >
          Soy Pasajero
        </Link>

        <Link
          href="/taxista"
          className="rounded-xl bg-white px-6 py-3 text-center font-semibold text-black transition hover:bg-gray-200"
        >
          Soy Taxista
        </Link>

        <Link
          href="/administracion"
          className="rounded-xl bg-gray-700 px-6 py-3 text-center font-semibold transition hover:bg-gray-600"
        >
          Administración
        </Link>
      </div>
    </main>
  );
}
