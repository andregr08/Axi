"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  Route,
  Save,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { PushNotificationsCard } from "@/components/notifications/PushNotificationsCard";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/utils/cn";

type UserRole = "admin" | "driver" | "passenger";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  rating: number;
  total_trips: number;
  account_active: boolean;
  created_at: string;
  language: "es" | "en";
};

const roleLabelKeys: Record<UserRole, string> = {
  admin: "roles.admin",
  driver: "roles.driver",
  passenger: "roles.passenger",
};

function formatDate(
  value: string,
  locale: "es" | "en"
) {
  return new Intl.DateTimeFormat(
    locale === "es" ? "es-MX" : "en-US",
    {
      dateStyle: "long",
    }
  ).format(new Date(value));
}

export default function ProfilePage() {
  const router = useRouter();
  const { locale, setLocale, t } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
const [language, setLanguage] = useState<"es" | "en">("es");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setEmail(session.user.email ?? "");

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        avatar_url,
        role,
        rating,
        total_trips,
        account_active,
        created_at,
      language
      `)
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      setProfileMessage(
        `${t("profile.loadProfileError")} ${
          error?.message ?? t("profile.profileNotFound")
        }`
      );
      setLoading(false);
      return;
    }

    const loadedProfile = data as Profile;

    setProfile(loadedProfile);
    setName(loadedProfile.full_name ?? "");
    setPhone(loadedProfile.phone ?? "");
const savedLanguage =
      loadedProfile.language === "en" ? "en" : "es";

    setLanguage(savedLanguage);
    setLocale(savedLanguage);
    setLoading(false);
  }, [router, setLocale, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  async function handleSaveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setProfileMessage("");

    if (!name.trim()) {
      setProfileMessage(t("profile.enterFullName"));
      return;
    }

    if (phone.trim() && phone.replace(/\D/g, "").length < 10) {
      setProfileMessage(t("profile.invalidPhone"));
      return;
    }

    setSavingProfile(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setSavingProfile(false);
      router.replace("/login");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim(),
        phone: phone.trim() || null,
        language,
      })
      .eq("id", session.user.id);

    if (profileError) {
      setProfileMessage(
        `${t("profile.updateProfileError")} ${profileError.message}`
      );
      setSavingProfile(false);
      return;
    }

    setLocale(language);

    const { error: authError } =
      await supabase.auth.updateUser({
        data: {
          full_name: name.trim(),
        },
      });

    if (authError) {
      setProfileMessage(
        `${t("profile.authNameUpdateError")} ${authError.message}`
      );
    } else {
      setProfileMessage(t("profile.profileUpdated"));
    }

    await loadProfile();
    setSavingProfile(false);
  }

  async function handleChangePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordMessage(t("profile.passwordMin"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage(
        t("profile.passwordsDoNotMatch")
      );
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordMessage(
        `${t("profile.passwordUpdateError")} ${error.message}`
      );
    } else {
      setPasswordMessage(t("profile.passwordUpdated"));
      setNewPassword("");
      setConfirmPassword("");
    }

    setSavingPassword(false);
  }

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="h-72 animate-pulse rounded-[2rem] bg-slate-200" />

        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="h-[460px] animate-pulse rounded-[2rem] bg-slate-200" />
          <div className="h-[620px] animate-pulse rounded-[2rem] bg-slate-200" />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <Card>
        <p className="font-semibold text-red-700">
          {profileMessage || t("profile.loadingError")}
        </p>
      </Card>
    );
  }

  const initial =
    profile.full_name?.trim().charAt(0).toUpperCase() || "A";

  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0B0F19] px-6 py-8 text-white shadow-[0_25px_80px_rgba(15,23,42,0.2)] sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border-4 border-white/10 bg-yellow-400 text-4xl font-black text-black shadow-2xl">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || t("profile.userFallback")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>

              <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border-4 border-[#0B0F19] bg-white text-slate-700">
                <Camera size={17} />
              </span>
            </div>

            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-yellow-300">
                <UserRound size={14} />
                {t("profile.myAccount")}
              </span>

              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                {profile.full_name || t("profile.userFallback")}
              </h1>

              <div className="mt-4 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200">
                  <ShieldCheck
                    size={17}
                    className="text-yellow-400"
                  />
                  {t(roleLabelKeys[profile.role])}
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold",
                    profile.account_active
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-red-400/15 text-red-300"
                  )}
                >
                  <CheckCircle2 size={17} />
                  {profile.account_active
                    ? t("profile.accountActive")
                    : t("profile.accountSuspended")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-md">
            <HeroMetric
              label={t("profile.rating")}
              value={Number(profile.rating ?? 5).toFixed(1)}
              icon={Star}
            />

            <HeroMetric
              label={t("profile.trips")}
              value={String(profile.total_trips ?? 0)}
              icon={Route}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.62fr_1.38fr]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {t("profile.summary")}
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {t("profile.accountInformation")}
                </h2>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                <BadgeCheck size={23} />
              </span>
            </div>

            <div className="mt-7 space-y-3">
              <AccountRow
                icon={Mail}
                label={t("profile.email")}
                value={email || t("profile.notRegistered")}
              />

              <AccountRow
                icon={Phone}
                label={t("profile.phone")}
                value={profile.phone || t("profile.notRegistered")}
              />

              <AccountRow
                icon={ShieldCheck}
                label={t("profile.accountType")}
                value={t(roleLabelKeys[profile.role])}
              />

              <AccountRow
                icon={CalendarDays}
                label={t("profile.memberSince")}
                value={formatDate(profile.created_at, locale)}
              />
            </div>
          </Card>

          <Card className="bg-[#0B0F19] text-white">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <LockKeyhole size={22} />
              </span>

              <div>
                <h2 className="text-lg font-black">
                  {t("profile.accountSecurity")}
                </h2>

                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {t("profile.securityDescription")}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <SecurityItem label={t("profile.protectedSession")} />
              <SecurityItem label={t("profile.encryptedPassword")} />
              <SecurityItem label={t("profile.roleBasedAccess")} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {t("profile.personalData")}
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {t("profile.editProfile")}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {t("profile.editProfileDescription")}
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <UserRound size={23} />
              </span>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="full-name"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  {t("profile.fullName")}
                </label>

                <div className="relative">
                  <UserRound
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="full-name"
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    placeholder={t("profile.fullNamePlaceholder")}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  {t("profile.phone")}
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(event.target.value)
                    }
                    placeholder={t("profile.phonePlaceholder")}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                  />
                </div>
              </div>              <div>
                <label
                  htmlFor="language"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  {t("profile.language")}
                </label>

                <select
                  id="language"
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as "es" | "en")
                  }
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="es">{t("profile.spanish")}</option>
                  <option value="en">{t("profile.english")}</option>
                </select>

                <p className="mt-2 text-xs text-slate-400">
                  {t("profile.languageDescription")}
                </p>
              </div>


              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-black text-slate-700"
                >
                  {t("profile.email")}
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    value={email}
                    disabled
                    className="h-14 w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 pl-12 pr-4 font-semibold text-slate-500"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {t("profile.emailChangeLater")}
                </p>
              </div>

              {profileMessage && (
                <MessageBox message={profileMessage} />
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 font-black text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                    {t("profile.saving")}
                  </>
                ) : (
                  <>
                    <Save size={19} />
                    {t("profile.saveChanges")}
                  </>
                )}
              </button>
            </form>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  {t("profile.security")}
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {t("profile.changePassword")}</h2>

                <p className="mt-2 text-sm text-slate-500">
                  {t("profile.passwordDescription")}
                </p>
              </div>

              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <KeyRound size={23} />
              </span>
            </div>

            <form
              onSubmit={handleChangePassword}
              className="mt-7 space-y-5"
            >
              <PasswordInput
                id="new-password"
                label={t("profile.newPassword")}
                value={newPassword}
                showPassword={showPassword}
                onChange={setNewPassword}
                onToggle={() =>
                  setShowPassword((current) => !current)
                }
                placeholder={t("profile.passwordPlaceholder")}
                showLabel={t("profile.showPassword")}
                hideLabel={t("profile.hidePassword")}
              />

              <PasswordInput
                id="confirm-password"
                label={t("profile.confirmPassword")}
                value={confirmPassword}
                showPassword={showPassword}
                onChange={setConfirmPassword}
                onToggle={() =>
                  setShowPassword((current) => !current)
                }
                placeholder={t("profile.passwordPlaceholder")}
                showLabel={t("profile.showPassword")}
                hideLabel={t("profile.hidePassword")}
              />

              {passwordMessage && (
                <MessageBox message={passwordMessage} />
              )}

              <button
                type="submit"
                disabled={savingPassword}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-950 bg-white px-6 font-black text-slate-950 transition hover:bg-slate-950 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                {savingPassword ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                    {t("profile.updating")}
                  </>
                ) : (
                  <>
                    <KeyRound size={19} />
                    {t("profile.updatePassword")}</>
                )}
              </button>
            </form>
          </Card>
        
          <PushNotificationsCard />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Star;
}) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
      <Icon size={21} className="text-yellow-400" />

      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function AccountRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
        <Icon size={18} />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-1 break-words text-sm font-black text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  showPassword,
  onChange,
  onToggle,
  placeholder,
  showLabel,
  hideLabel,
}: {
  id: string;
  label: string;
  value: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-black text-slate-700"
      >
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          autoComplete="new-password"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-14 font-semibold text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={
            showPassword ? hideLabel : showLabel
          }
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-950"
        >
          {showPassword ? (
            <EyeOff size={19} />
          ) : (
            <Eye size={19} />
          )}
        </button>
      </div>
    </div>
  );
}


function MessageBox({
  message,
}: {
  message: string;
}) {
  const successful =
    message.toLowerCase().includes("correctamente") ||
    message.toLowerCase().includes("actualizado") ||
    message.toLowerCase().includes("successfully") ||
    message.toLowerCase().includes("saved");

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-semibold",
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}
    >
      {message}
    </div>
  );
}

function SecurityItem({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400">
        <CheckCircle2 size={16} />
      </span>

      <p className="text-sm font-bold text-slate-300">
        {label}
      </p>
    </div>
  );
}






