import Link from "next/link";

export default function TaxistaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <h1 className="text-4xl font-bold text-yellow-400">Taxista</h1>
      <p className="mt-4 text-center text-gray-300">
        Aquí podrás recibir viajes y administrar tu actividad.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-xl bg-white px-6 py-3 font-semibold text-black"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
