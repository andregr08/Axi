import Link from "next/link";
import {
  ArrowRight,
  CarFront,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  ShieldCheck,
  Smartphone,
  Star,
  UsersRound,
} from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const features = [
  {
    icon: MapPin,
    title: "Viajes inteligentes",
    description:
      "Solicita un viaje, consulta tu ruta y administra toda tu actividad desde AXI.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad primero",
    description:
      "Conductores, vehículos y cuentas preparados para procesos de verificación.",
  },
  {
    icon: Clock3,
    title: "Movilidad rápida",
    description:
      "Una experiencia diseñada para conectar pasajeros y conductores sin complicaciones.",
  },
];

const stats = [
  {
    value: "24/7",
    label: "Plataforma disponible",
  },
  {
    value: "3",
    label: "Perfiles de usuario",
  },
  {
    value: "1",
    label: "Ecosistema AXI",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F4F6F8] text-slate-950">
      <section className="relative overflow-hidden bg-[#0B0F19] text-white">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-yellow-400/15 blur-3xl" />
        <div className="absolute -bottom-48 right-0 h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />

        <header className="relative z-20 mx-auto flex w-full max-w-[1500px] items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
          <Logo dark />

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-300 md:flex">
            <a href="#como-funciona" className="transition hover:text-white">
              Cómo funciona
            </a>

            <a href="#beneficios" className="transition hover:text-white">
              Beneficios
            </a>

            <a href="#conductores" className="transition hover:text-white">
              Conductores
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-2xl px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              Iniciar sesión
            </Link>

            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-yellow-400 px-5 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-yellow-300"
            >
              Crear cuenta
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-[1500px] items-center gap-14 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:pb-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-yellow-300">
              <Navigation size={15} />
              Movilidad inteligente
            </span>

            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
              Tu ciudad,
              <br />
              mejor conectada.
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              AXI conecta pasajeros, conductores y administradores mediante una
              plataforma moderna, segura y preparada para operar desde
              cualquier dispositivo.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-7 font-black text-black shadow-xl shadow-yellow-400/10 transition hover:-translate-y-0.5 hover:bg-yellow-300"
              >
                Empezar con AXI
                <ArrowRight size={19} />
              </Link>

              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 font-black text-white transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Entrar a mi cuenta
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-400">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-yellow-400" />
                Pasajeros
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-yellow-400" />
                Conductores
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 size={17} className="text-yellow-400" />
                Administración
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -inset-10 rounded-full bg-yellow-400/10 blur-3xl" />

            <div className="relative rounded-[2.5rem] border border-white/10 bg-white/[0.05] p-4 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="relative min-h-[540px] overflow-hidden rounded-[2rem] bg-[#E8EDF1]">
                <div className="absolute inset-0 opacity-75">
                  <div className="absolute left-[16%] top-0 h-full w-9 rotate-[16deg] bg-white" />
                  <div className="absolute left-[52%] top-0 h-full w-7 -rotate-[11deg] bg-white/90" />
                  <div className="absolute right-[13%] top-0 h-full w-8 rotate-[8deg] bg-white" />

                  <div className="absolute left-0 top-[19%] h-8 w-full -rotate-[5deg] bg-white" />
                  <div className="absolute left-0 top-[51%] h-7 w-full rotate-[6deg] bg-white/90" />
                  <div className="absolute bottom-[14%] left-0 h-9 w-full -rotate-[2deg] bg-white" />
                </div>

                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 700 540"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M115 410 C190 330, 245 240, 350 276 C465 315, 482 145, 600 155"
                    fill="none"
                    stroke="rgba(15,23,42,0.16)"
                    strokeWidth="15"
                    strokeLinecap="round"
                  />

                  <path
                    d="M115 410 C190 330, 245 240, 350 276 C465 315, 482 145, 600 155"
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray="10 12"
                  />
                </svg>

                <div className="absolute left-[13%] top-[72%]">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-yellow-400 text-black shadow-xl">
                    <MapPin size={23} />
                  </span>
                </div>

                <div className="absolute left-[80%] top-[22%]">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[#0B0F19] text-yellow-400 shadow-xl">
                    <Navigation size={23} />
                  </span>
                </div>

                {[
                  ["28%", "24%"],
                  ["51%", "43%"],
                  ["71%", "68%"],
                  ["31%", "67%"],
                ].map(([left, top]) => (
                  <div
                    key={`${left}-${top}`}
                    className="absolute"
                    style={{ left, top }}
                  >
                    <span className="absolute -right-1 -top-1 z-10 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />

                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-white bg-[#0B0F19] text-yellow-400 shadow-xl">
                      <CarFront size={20} />
                    </span>
                  </div>
                ))}

                <div className="absolute left-5 right-5 top-5 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xl backdrop-blur sm:left-7 sm:right-auto sm:w-[320px]">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                      <Navigation size={22} />
                    </span>

                    <div>
                      <p className="font-black text-slate-950">
                        ¿A dónde vamos?
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Puebla, México
                      </p>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-5 left-5 right-5 rounded-3xl bg-[#0B0F19] p-5 text-white shadow-2xl sm:bottom-7 sm:left-7 sm:right-7">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                      <CarFront size={23} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-black">Tu AXI está cerca</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        Movilidad segura y sencilla
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
                      En línea
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-[1350px] grid-cols-1 divide-y divide-slate-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {stats.map((stat) => (
            <div key={stat.label} className="px-6 py-10 text-center">
              <p className="text-4xl font-black tracking-tight text-slate-950">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="beneficios"
        className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
            Una plataforma completa
          </p>

          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Todo lo necesario para moverte mejor
          </h2>

          <p className="mt-5 text-base leading-8 text-slate-500">
            AXI reúne viajes, cuentas, vehículos y operación en una experiencia
            clara para cada tipo de usuario.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="group rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700 transition group-hover:bg-yellow-400 group-hover:text-black">
                  <Icon size={25} />
                </span>

                <h3 className="mt-7 text-2xl font-black">{feature.title}</h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="como-funciona"
        className="bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto grid w-full max-w-[1400px] items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-600">
              Cómo funciona
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Empieza en pocos pasos
            </h2>

            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
              Desde crear una cuenta hasta solicitar o aceptar un viaje, AXI
              está diseñado para ser fácil de entender.
            </p>

            <div className="mt-10 space-y-5">
              {[
                {
                  number: "01",
                  title: "Crea tu cuenta",
                  text: "Regístrate como pasajero o solicita convertirte en conductor.",
                },
                {
                  number: "02",
                  title: "Configura tu perfil",
                  text: "Agrega tus datos, vehículo y métodos de pago según tu rol.",
                },
                {
                  number: "03",
                  title: "Empieza a usar AXI",
                  text: "Solicita viajes, recibe solicitudes o administra la operación.",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className="flex gap-5 rounded-3xl border border-slate-200 bg-[#F8FAFC] p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B0F19] text-sm font-black text-yellow-400">
                    {step.number}
                  </span>

                  <div>
                    <p className="text-lg font-black">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-[#0B0F19] p-6 text-white shadow-2xl sm:p-9">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6">
              <div className="flex items-center justify-between">
                <Logo dark />
                <Smartphone className="text-yellow-400" size={28} />
              </div>

              <div className="mt-10 rounded-[1.7rem] bg-yellow-400 p-6 text-black">
                <p className="text-xs font-black uppercase tracking-[0.18em]">
                  AXI Mobility
                </p>

                <h3 className="mt-3 text-3xl font-black">
                  Una experiencia para cada usuario
                </h3>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: UsersRound,
                      label: "Pasajero",
                    },
                    {
                      icon: CarFront,
                      label: "Conductor",
                    },
                    {
                      icon: ShieldCheck,
                      label: "Admin",
                    },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="rounded-2xl bg-black/10 p-4 text-center"
                      >
                        <Icon className="mx-auto" size={23} />
                        <p className="mt-3 text-sm font-black">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Star className="text-yellow-400" size={21} />

                  <div>
                    <p className="font-black">Experiencia premium</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Responsive para móvil, tableta y web
                    </p>
                  </div>
                </div>

                <ArrowRight size={19} className="text-slate-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="conductores"
        className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="relative overflow-hidden rounded-[2.5rem] bg-yellow-400 px-6 py-12 text-black sm:px-10 lg:px-16 lg:py-16">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/30 blur-3xl" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">
                Conduce con AXI
              </p>

              <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                Convierte tu vehículo en una nueva oportunidad
              </h2>

              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-black/70">
                Crea tu cuenta, envía tu solicitud y administra tu disponibilidad
                desde el panel del conductor.
              </p>
            </div>

            <Link
              href="/register"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B0F19] px-7 font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Quiero conducir
              <ArrowRight size={19} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Logo />

          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
            <Link href="/login" className="transition hover:text-slate-950">
              Iniciar sesión
            </Link>

            <Link href="/register" className="transition hover:text-slate-950">
              Crear cuenta
            </Link>

            <span>Privacidad</span>
            <span>Términos</span>
          </div>

          <p className="text-sm text-slate-400">
            © 2026 AXI Mobility
          </p>
        </div>
      </footer>
    </main>
  );
}
