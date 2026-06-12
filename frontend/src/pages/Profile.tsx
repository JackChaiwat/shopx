import { useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import {
  BadgeCheck,
  Camera,
  Home,
  Lock,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Save,
  Shield,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input, Modal, Spinner } from "@/components/ui";
import MapPinPicker from "@/components/MapPinPicker";
import api from "@/services/api";
import toast from "react-hot-toast";

const ADDRESS_LABEL_HOME = "\u0e1a\u0e49\u0e32\u0e19";
const ADDRESS_LABEL_WORK = "\u0e17\u0e35\u0e48\u0e17\u0e33\u0e07\u0e32\u0e19";
const ADDRESS_LABEL_DORM = "\u0e2b\u0e2d";
const ADDRESS_LABEL_CONDO = "\u0e04\u0e2d\u0e19\u0e42\u0e14";
const ADDRESS_LABEL_OTHER = "\u0e2d\u0e37\u0e48\u0e19\u0e46";
const ADDRESS_LABEL_OPTIONS = [ADDRESS_LABEL_HOME, ADDRESS_LABEL_WORK, ADDRESS_LABEL_DORM, ADDRESS_LABEL_CONDO, ADDRESS_LABEL_OTHER];

interface ProfileForm {
  full_name: string;
  phone: string;
  username: string;
}

interface AddressForm {
  label: string;
  label_other: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: string;
  longitude: string;
}

function ChangePasswordForm(): JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<{ current: string; new: string; confirm: string }>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (data: { current: string; new: string }) => {
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: data.current, new_password: data.new });
      toast.success("à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸šà¹ƒà¸«à¸¡à¹ˆ");
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
          <Lock size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-950 dark:text-white">à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">à¹ƒà¸Šà¹‰à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆà¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 8 à¸•à¸±à¸§à¸­à¸±à¸à¸©à¸£</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™" type="password" {...register("current", { required: "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™" })} error={errors.current?.message} />
        <Input label="à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ" type="password" {...register("new", { required: "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ", minLength: { value: 8, message: "à¸­à¸¢à¹ˆà¸²à¸‡à¸™à¹‰à¸­à¸¢ 8 à¸•à¸±à¸§à¸­à¸±à¸à¸©à¸£" } })} error={errors.new?.message} />
        <Input label="à¸¢à¸·à¸™à¸¢à¸±à¸™à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹ƒà¸«à¸¡à¹ˆ" type="password" {...register("confirm", { validate: (value) => value === watch("new") || "à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™à¹„à¸¡à¹ˆà¸•à¸£à¸‡à¸à¸±à¸™" })} error={errors.confirm?.message} />
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Spinner className="h-4 w-4" /> : <Save size={16} />}
            à¸šà¸±à¸™à¸—à¸¶à¸à¸£à¸«à¸±à¸ªà¸œà¹ˆà¸²à¸™
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<"profile" | "addresses" | "security">("profile");
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addrLoaded, setAddrLoaded] = useState(false);
  const [addrModal, setAddrModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    defaultValues: { full_name: user?.full_name ?? "", phone: "", username: "" },
  });

  const addrForm = useForm<AddressForm>({
    defaultValues: {
      label: ADDRESS_LABEL_HOME,
      label_other: "",
      recipient_name: "",
      phone: "",
      address_line1: "",
      city: "",
      state: "",
      postal_code: "",
      latitude: "",
      longitude: "",
    },
  });

  const loadAddresses = async () => {
    const res = await api.get("/users/me/addresses");
    setAddresses(res.data.data || []);
    setAddrLoaded(true);
  };

  const onTabChange = async (nextTab: typeof tab) => {
    setTab(nextTab);
    if (nextTab === "addresses" && !addrLoaded) {
      await loadAddresses();
    }
  };

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await api.patch("/users/me", data);
      const meRes = await api.get("/auth/me");
      setUser(meRes.data.data);
      toast.success("à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸šà¸±à¸à¸Šà¸µà¹à¸¥à¹‰à¸§");
    } catch {
      toast.error("à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post("/users/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
      const meRes = await api.get("/auth/me");
      setUser(meRes.data.data);
      toast.success("à¸­à¸±à¸›à¹€à¸”à¸•à¸£à¸¹à¸›à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¹‰à¸§");
    } catch {
      toast.error("à¸­à¸±à¸›à¹‚à¸«à¸¥à¸”à¸£à¸¹à¸›à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    }
  };

  const onAddAddress = async (data: AddressForm) => {
    try {
      await api.post("/users/me/addresses", {
        ...data,
        label: data.label === ADDRESS_LABEL_OTHER ? data.label_other?.trim() || ADDRESS_LABEL_OTHER : data.label || ADDRESS_LABEL_HOME,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        country: "TH",
      });
      await loadAddresses();
      setAddrModal(false);
      addrForm.reset({ label: ADDRESS_LABEL_HOME });
      toast.success("à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§");
    } catch {
      toast.error("à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    }
  };

  const onDeleteAddress = async (id: string) => {
    try {
      await api.delete(`/users/me/addresses/${id}`);
      setAddresses((current) => current.filter((address) => address.id !== id));
      toast.success("à¸¥à¸šà¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§");
    } catch {
      toast.error("à¸¥à¸šà¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    }
  };

  const addressLatitude = addrForm.watch("latitude");
  const addressLongitude = addrForm.watch("longitude");
  const addressLabel = addrForm.watch("label") || ADDRESS_LABEL_HOME;

  const tabs = [
    { id: "profile", label: "à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œ", icon: User },
    { id: "addresses", label: "à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ", icon: MapPin },
    { id: "security", label: "à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢", icon: Shield },
  ] as const;

  return (
    <>
      <Helmet>
        <title>à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸šà¸±à¸à¸Šà¸µ - ShopX</title>
      </Helmet>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-orange-100">
                  <Sparkles size={14} />
                  Account Center
                </div>
                <h1 className="text-2xl font-bold sm:text-3xl">à¸•à¸±à¹‰à¸‡à¸„à¹ˆà¸²à¸šà¸±à¸à¸Šà¸µ</h1>
                <p className="mt-1 text-sm text-slate-300">à¸ˆà¸±à¸”à¸à¸²à¸£à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§ à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡ à¹à¸¥à¸°à¸„à¸§à¸²à¸¡à¸›à¸¥à¸­à¸”à¸ à¸±à¸¢à¸‚à¸­à¸‡à¸šà¸±à¸à¸Šà¸µ</p>
              </div>

              <div className="flex items-center gap-4 rounded-lg bg-white/10 p-4 backdrop-blur">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-orange-500 ring-4 ring-white/20">
                    {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : <User size={30} />}
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-orange-500 p-1.5 text-white shadow hover:bg-orange-600">
                    <Camera size={13} />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                </div>
                <div>
                  <p className="font-semibold">{user?.full_name || "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¹„à¸”à¹‰à¸•à¸±à¹‰à¸‡à¸Šà¸·à¹ˆà¸­"}</p>
                  <p className="text-sm text-slate-300">{user?.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-semibold text-orange-100">{user?.role || "buyer"}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${user?.is_email_verified ? "bg-emerald-500/20 text-emerald-100" : "bg-yellow-500/20 text-yellow-100"}`}>
                      <BadgeCheck size={12} />
                      {user?.is_email_verified ? "à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥à¹à¸¥à¹‰à¸§" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-gray-200 p-4 dark:border-slate-800 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-950/60">
              <p className="text-xs text-gray-500 dark:text-slate-400">à¸­à¸µà¹€à¸¡à¸¥</p>
              <p className="mt-1 truncate font-semibold text-gray-950 dark:text-white">{user?.email || "-"}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-950/60">
              <p className="text-xs text-gray-500 dark:text-slate-400">à¸ªà¸´à¸—à¸˜à¸´à¹Œà¸šà¸±à¸à¸Šà¸µ</p>
              <p className="mt-1 font-semibold capitalize text-gray-950 dark:text-white">{user?.role || "buyer"}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-950/60">
              <p className="text-xs text-gray-500 dark:text-slate-400">à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡</p>
              <p className="mt-1 font-semibold text-gray-950 dark:text-white">{addrLoaded ? `${addresses.length} à¸£à¸²à¸¢à¸à¸²à¸£` : "à¸à¸”à¸”à¸¹à¹ƒà¸™à¹à¸—à¹‡à¸šà¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    active ? "bg-orange-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </aside>

          <main className="min-w-0">
            {tab === "profile" && (
              <form onSubmit={handleSubmit(onSaveProfile)} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-gray-950 dark:text-white">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸ªà¹ˆà¸§à¸™à¸•à¸±à¸§</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">à¸‚à¹‰à¸­à¸¡à¸¹à¸¥à¸™à¸µà¹‰à¹ƒà¸Šà¹‰à¹à¸ªà¸”à¸‡à¹ƒà¸™à¸£à¸°à¸šà¸šà¹à¸¥à¸°à¸•à¸´à¸”à¸•à¹ˆà¸­à¹€à¸£à¸·à¹ˆà¸­à¸‡à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸‹à¸·à¹‰à¸­</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Input label="à¸Šà¸·à¹ˆà¸­-à¸™à¸²à¸¡à¸ªà¸à¸¸à¸¥" {...register("full_name", { required: "à¸à¸£à¸¸à¸“à¸²à¸à¸£à¸­à¸à¸Šà¸·à¹ˆà¸­" })} error={errors.full_name?.message} />
                  </div>
                  <Input label="à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰" placeholder="à¹„à¸¡à¹ˆà¸šà¸±à¸‡à¸„à¸±à¸š" {...register("username")} />
                  <Input label="à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£à¸¨à¸±à¸žà¸—à¹Œ" placeholder="+66..." {...register("phone")} />
                </div>

                <div className="mt-6 flex justify-end">
                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? <Spinner className="h-4 w-4" /> : <Save size={16} />}
                    à¸šà¸±à¸™à¸—à¸¶à¸à¸‚à¹‰à¸­à¸¡à¸¹à¸¥
                  </button>
                </div>
              </form>
            )}

            {tab === "addresses" && (
              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-950 dark:text-white">à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¸ˆà¸±à¸”à¸ªà¹ˆà¸‡</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">à¸šà¸±à¸™à¸—à¸¶à¸à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹à¸¥à¸°à¸›à¸±à¸à¸«à¸¡à¸¸à¸”à¹€à¸žà¸·à¹ˆà¸­à¸„à¸³à¸™à¸§à¸“à¸„à¹ˆà¸²à¸ªà¹ˆà¸‡</p>
                  </div>
                  <button type="button" onClick={() => setAddrModal(true)} className="btn btn-primary">
                    <Plus size={16} />
                    à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-slate-700">
                    <MapPin className="mx-auto mb-3 h-9 w-9 text-gray-400" />
                    <p className="font-semibold text-gray-950 dark:text-white">à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¡à¸µà¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ</p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹à¸£à¸à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸Šà¹‰à¸•à¸­à¸™à¸Šà¸³à¸£à¸°à¹€à¸‡à¸´à¸™</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {addresses.map((address) => (
                      <div key={address.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                              <Home size={19} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-gray-950 dark:text-white">{address.recipient_name}</p>
                                <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-300">{address.label}</span>
                                {address.is_default && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">à¸„à¹ˆà¸²à¹€à¸£à¸´à¹ˆà¸¡à¸•à¹‰à¸™</span>}
                              </div>
                              <p className="mt-1 flex items-center gap-1 text-sm text-gray-600 dark:text-slate-400"><Phone size={14} /> {address.phone}</p>
                              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{address.address_line1}, {address.city}, {address.state} {address.postal_code}</p>
                              {address.latitude && address.longitude && (
                                <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:underline" href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`} target="_blank" rel="noreferrer">
                                  <Navigation size={13} />
                                  à¸”à¸¹à¸«à¸¡à¸¸à¸”à¹ƒà¸™ Google Maps
                                </a>
                              )}
                            </div>
                          </div>
                          <button type="button" onClick={() => onDeleteAddress(address.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-500" aria-label="Remove address">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {tab === "security" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-950 dark:text-white">à¸­à¸µà¹€à¸¡à¸¥à¸šà¸±à¸à¸Šà¸µ</h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{user?.email}</p>
                      <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${user?.is_email_verified ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-300"}`}>
                        {user?.is_email_verified ? "à¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥à¹à¸¥à¹‰à¸§" : "à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸¢à¸·à¸™à¸¢à¸±à¸™à¸­à¸µà¹€à¸¡à¸¥"}
                      </span>
                    </div>
                  </div>
                </div>
                <ChangePasswordForm />
              </div>
            )}
          </main>
        </div>
      </div>

      <Modal open={addrModal} onClose={() => setAddrModal(false)} title="à¹€à¸žà¸´à¹ˆà¸¡à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆà¹ƒà¸«à¸¡à¹ˆ">
        <form onSubmit={addrForm.handleSubmit(onAddAddress)} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">à¸›à¸£à¸°à¹€à¸ à¸—à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ADDRESS_LABEL_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    addressLabel === option ? "border-orange-500 bg-orange-500 text-white" : "border-gray-300 bg-gray-50 text-gray-700 hover:border-orange-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <input type="radio" value={option} {...addrForm.register("label", { required: true })} className="sr-only" />
                  {option}
                </label>
              ))}
            </div>
            {addressLabel === ADDRESS_LABEL_OTHER && (
              <div className="mt-3">
                <Input label="à¸Šà¸·à¹ˆà¸­à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ" placeholder="à¹€à¸Šà¹ˆà¸™ à¸šà¹‰à¸²à¸™à¹à¸¡à¹ˆ / à¹‚à¸à¸”à¸±à¸‡ / à¸£à¹‰à¸²à¸™" {...addrForm.register("label_other", { required: addressLabel === ADDRESS_LABEL_OTHER })} />
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="à¸Šà¸·à¹ˆà¸­à¸œà¸¹à¹‰à¸£à¸±à¸š" {...addrForm.register("recipient_name", { required: true })} />
            <Input label="à¹€à¸šà¸­à¸£à¹Œà¹‚à¸—à¸£" {...addrForm.register("phone", { required: true })} />
            <div className="sm:col-span-2">
              <Input label="à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ" {...addrForm.register("address_line1", { required: true })} />
            </div>
            <Input label="à¸­à¸³à¹€à¸ à¸­ / à¹€à¸‚à¸•" {...addrForm.register("city", { required: true })} />
            <Input label="à¸ˆà¸±à¸‡à¸«à¸§à¸±à¸”" {...addrForm.register("state", { required: true })} />
            <Input label="à¸£à¸«à¸±à¸ªà¹„à¸›à¸£à¸©à¸“à¸µà¸¢à¹Œ" {...addrForm.register("postal_code", { required: true })} />
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
            <div className="mb-3 flex items-start gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="font-semibold text-gray-950 dark:text-white">à¸«à¸¡à¸¸à¸”à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">à¸¥à¸²à¸à¹à¸œà¸™à¸—à¸µà¹ˆà¹ƒà¸«à¹‰à¸«à¸¡à¸¸à¸”à¸­à¸¢à¸¹à¹ˆà¸•à¸£à¸‡à¸ˆà¸¸à¸”à¸ˆà¸±à¸”à¸ªà¹ˆà¸‡ à¹ƒà¸Šà¹‰à¸ªà¸³à¸«à¸£à¸±à¸šà¸„à¸³à¸™à¸§à¸“à¸„à¹ˆà¸²à¸ªà¹ˆà¸‡</p>
              </div>
            </div>
            <MapPinPicker
              latitude={addressLatitude}
              longitude={addressLongitude}
              onChange={(lat, lng) => {
                addrForm.setValue("latitude", lat, { shouldDirty: true });
                addrForm.setValue("longitude", lng, { shouldDirty: true });
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddrModal(false)} className="btn btn-secondary">à¸¢à¸à¹€à¸¥à¸´à¸</button>
            <button type="submit" className="btn btn-primary">à¸šà¸±à¸™à¸—à¸¶à¸à¸—à¸µà¹ˆà¸­à¸¢à¸¹à¹ˆ</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

