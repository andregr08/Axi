export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-yellow-400">AXI</h1>

      <p className="mt-4 text-xl text-gray-300">
        Plataforma Inteligente para Taxis
      </p>

      <div className="mt-10 flex gap-4">
        <button className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-300">
          Soy Pasajero
        </button>

        <button className="bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-gray-200">
          Soy Taxista
        </button>

        <button className="bg-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-600">
          Administración
        </button>
      </div>
    </main>
  );
}