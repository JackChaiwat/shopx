import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { User, Camera, MapPin, Plus } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Input, Spinner, Modal } from "@/components/ui";
import MapPinPicker from "@/components/MapPinPicker";
import api from "@/services/api";
import toast from "react-hot-toast";

const ADDRESS_LABEL_HOME = "\u0e1a\u0e49\u0e32\u0e19";
const ADDRESS_LABEL_WORK = "\u0e17\u0e35\u0e48\u0e17\u0e33\u0e07\u0e32\u0e19";
const ADDRESS_LABEL_DORM = "\u0e2b\u0e2d";
const ADDRESS_LABEL_CONDO = "\u0e04\u0e2d\u0e19\u0e42\u0e14";
const ADDRESS_LABEL_OTHER = "\u0e2d\u0e37\u0e48\u0e19\u0e46";
const ADDRESS_LABEL_OPTIONS = [ADDRESS_LABEL_HOME, ADDRESS_LABEL_WORK, ADDRESS_LABEL_DORM, ADDRESS_LABEL_CONDO, ADDRESS_LABEL_OTHER];

const parseMapCoordinates = (value?: string | null) => {
  if (!value) return null;
  const text = decodeURIComponent(value);
  const match = text.match(/@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/) || text.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;
  return { lat: match[1], lng: match[2] };
};

const buildMapQuery = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(", ");

const TEXT_ADDRESS_TYPE = "\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48";
const TEXT_CUSTOM_ADDRESS_LABEL = "\u0e0a\u0e37\u0e48\u0e2d\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48";
const TEXT_CUSTOM_ADDRESS_PLACEHOLDER = "\u0e40\u0e0a\u0e48\u0e19 \u0e1a\u0e49\u0e32\u0e19\u0e41\u0e21\u0e48 / \u0e42\u0e01\u0e14\u0e31\u0e07 / \u0e23\u0e49\u0e32\u0e19";
const TEXT_MAP_ADDRESS_LABEL = "\u0e17\u0e35\u0e48\u0e2d\u0e22\u0e39\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e25\u0e34\u0e07\u0e01\u0e4c Google Maps";
const TEXT_MAP_ADDRESS_PLACEHOLDER = "\u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e0a\u0e37\u0e48\u0e2d\u0e2a\u0e16\u0e32\u0e19\u0e17\u0e35\u0e48 / \u0e27\u0e32\u0e07\u0e25\u0e34\u0e07\u0e01\u0e4c Google Maps / \u0e27\u0e32\u0e07\u0e1e\u0e34\u0e01\u0e31\u0e14";

interface ProfileForm { full_name: string; phone: string; username: string; }
interface AddressForm {
  label: string; label_other: string; recipient_name: string; phone: string;
  map_query: string;
  address_line1: string; city: string; state: string; postal_code: string;
  latitude: string; longitude: string;
}

// â”€â”€ à¸¢à¹‰à¸²à¸¢à¸‚à¸¶à¹‰à¸™à¸¡à¸²à¸à¹ˆà¸­à¸™ export default à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰ TypeScript infer return type à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡ â”€â”€
function ChangePasswordForm(): JSX.Element {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<{ current: string; new: string; confirm: string }>();
  const [saving, setSaving] = useState(false);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: data.current, new_password: data.new });
      toast.success("Password changed. Please login again.");
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Failed to change password");
    } finally { setSaving(false); }
  };

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Change Password</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Input label="Current Password" type="password" {...register("current", { required: "Required" })} error={errors.current?.message} />
        <Input label="New Password" type="password" {...register("new", { required: "Required", minLength: { value: 8, message: "Min 8 chars" } })} error={errors.new?.message} />
        <Input label="Confirm New Password" type="password" {...register("confirm", { validate: (v) => v === watch("new") || "Passwords don't match" })} error={errors.confirm?.message} />
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <Spinner className="w-4 h-4" /> : "Update Password"}
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

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: { full_name: user?.full_name ?? "", phone: "", username: "" },
  });

  const addrForm = useForm<AddressForm>({ defaultValues: { label: ADDRESS_LABEL_HOME } });

  const onTabChange = async (t: typeof tab) => {
    setTab(t);
    if (t === "addresses" && !addrLoaded) {
      const res = await api.get("/users/me/addresses");
      setAddresses(res.data.data);
      setAddrLoaded(true);
    }
  };

  const onSaveProfile = async (data: ProfileForm) => {
    setSaving(true);
    try {
      await api.patch("/users/me", data);
      const meRes = await api.get("/auth/me");
      setUser(meRes.data.data);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally { setSaving(false); }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post("/users/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } });
      const meRes = await api.get("/auth/me");
      setUser(meRes.data.data);
      toast.success("Avatar updated");
    } catch { toast.error("Failed to upload avatar"); }
  };

  const onAddAddress = async (data: AddressForm) => {
    try {
      await api.post("/users/me/addresses", {
        ...data,
        label: data.label === ADDRESS_LABEL_OTHER ? (data.label_other?.trim() || ADDRESS_LABEL_OTHER) : (data.label || ADDRESS_LABEL_HOME),
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
        country: "TH",
      });
      const res = await api.get("/users/me/addresses");
      setAddresses(res.data.data);
      setAddrModal(false);
      addrForm.reset();
      toast.success("Address added");
    } catch { toast.error("Failed to add address"); }
  };

  const onDeleteAddress = async (id: string) => {
    try {
      await api.delete(`/users/me/addresses/${id}`);
      setAddresses(addresses.filter((a) => a.id !== id));
      toast.success("Address removed");
    } catch { toast.error("Failed to delete address"); }
  };

  const useAddressCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser does not support location access");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        addrForm.setValue("latitude", position.coords.latitude.toFixed(7), { shouldDirty: true });
        addrForm.setValue("longitude", position.coords.longitude.toFixed(7), { shouldDirty: true });
        toast.success("Location added to address");
      },
      () => toast.error("Could not get your location. Please allow location access or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const useAddressMapTextForPin = () => {
    const text = addrForm.getValues("map_query") || buildMapQuery(addrForm.getValues("address_line1"), addrForm.getValues("city"), addrForm.getValues("state"), addrForm.getValues("postal_code"), "Thailand");
    const coords = parseMapCoordinates(text);
    if (coords) {
      addrForm.setValue("latitude", coords.lat, { shouldDirty: true });
      addrForm.setValue("longitude", coords.lng, { shouldDirty: true });
      toast.success("Map pin added from Google Maps text");
      return;
    }
    toast("Paste a Google Maps link or coordinates first.", { id: "map-pin-hint" });
  };

  const addressLatitude = addrForm.watch("latitude");
  const addressLongitude = addrForm.watch("longitude");
  const addressLabel = addrForm.watch("label") || ADDRESS_LABEL_HOME;

  return (
    <>
      <Helmet><title>Profile - ShopX</title></Helmet>
      <div className="max-w-3xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 card p-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary-100">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary-500">
                  <User size={28} />
                </div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 bg-primary-500 text-white p-1 rounded-full hover:bg-primary-600">
              <Camera size={12} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
          </div>
          <div>
            <p className="font-semibold">{user?.full_name || "No name set"}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`badge mt-1 ${user?.role === "admin" ? "badge-danger" : user?.role === "seller" ? "badge-info" : "badge-success"}`}>
              {user?.role}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {(["profile", "addresses", "security"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${
                tab === t ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <form onSubmit={handleSubmit(onSaveProfile)} className="space-y-4">
            <Input label="Full Name" {...register("full_name", { required: "Required" })} error={errors.full_name?.message} />
            <Input label="Username" placeholder="Optional" {...register("username")} />
            <Input label="Phone" placeholder="+66..." {...register("phone")} />
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <Spinner className="w-4 h-4" /> : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {/* Addresses tab */}
        {tab === "addresses" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{addresses.length} address{addresses.length !== 1 ? "es" : ""} saved</p>
              <button onClick={() => setAddrModal(true)} className="btn btn-primary btn-sm">
                <Plus size={14} /> Add Address
              </button>
            </div>
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{addr.recipient_name}</span>
                          <span className="badge badge-info">{addr.label}</span>
                          {addr.is_default && <span className="badge badge-success">Default</span>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{addr.phone}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {addr.address_line1}, {addr.city}, {addr.state} {addr.postal_code}
                        </p>
                        {addr.latitude && addr.longitude && (
                          <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline" href={`https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`} target="_blank" rel="noreferrer">
                            <MapPin size={13} /> View pin in Google Maps
                          </a>
                        )}
                      </div>
                    </div>
                    <button onClick={() => onDeleteAddress(addr.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <Modal open={addrModal} onClose={() => setAddrModal(false)} title="Add New Address">
              <form onSubmit={addrForm.handleSubmit(onAddAddress)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{TEXT_ADDRESS_TYPE} *</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {ADDRESS_LABEL_OPTIONS.map((option) => (
                        <label
                          key={option}
                          className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${addressLabel === option ? "border-primary-500 bg-primary-500 text-white" : "border-gray-300 bg-gray-50 text-gray-700 hover:border-primary-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"}`}
                        >
                          <input type="radio" value={option} {...addrForm.register("label", { required: true })} className="sr-only" />
                          {option}
                        </label>
                      ))}
                    </div>
                    {addressLabel === ADDRESS_LABEL_OTHER && (
                      <div className="mt-3">
                        <Input label={TEXT_CUSTOM_ADDRESS_LABEL} placeholder={TEXT_CUSTOM_ADDRESS_PLACEHOLDER} {...addrForm.register("label_other", { required: addressLabel === ADDRESS_LABEL_OTHER })} />
                      </div>
                    )}
                  </div>
                  <Input label="Recipient Name" {...addrForm.register("recipient_name", { required: true })} />
                  <Input label="Phone" {...addrForm.register("phone", { required: true })} />
                  <div className="sm:col-span-2">
                    <Input label="Address" {...addrForm.register("address_line1", { required: true })} />
                  </div>
                  <Input label="City" {...addrForm.register("city", { required: true })} />
                  <Input label="Province" {...addrForm.register("state", { required: true })} />
                  <Input label="Postal Code" {...addrForm.register("postal_code", { required: true })} />
                  <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2">
                        <MapPin size={18} className="mt-0.5 shrink-0 text-primary-500" />
                        <div>
                          <p className="font-semibold">Google Maps delivery pin</p>
                          <p className="text-xs text-gray-500">Drag the map until the pin is on the delivery point. This pin is used to calculate shipping.</p>
                        </div>
                      </div>
                      </div>
                    <div className="mb-3">
                      <Input label={TEXT_MAP_ADDRESS_LABEL} {...addrForm.register("map_query")} placeholder={TEXT_MAP_ADDRESS_PLACEHOLDER} />
                      <div className="mt-3">
                        <MapPinPicker
                          latitude={addressLatitude}
                          longitude={addressLongitude}
                          onChange={(lat, lng) => {
                            addrForm.setValue("latitude", lat, { shouldDirty: true });
                            addrForm.setValue("longitude", lng, { shouldDirty: true });
                          }}
                        />
                      </div>
                      </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setAddrModal(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Address</button>
                </div>
              </form>
            </Modal>
          </div>
        )}

        {/* Security tab */}
        {tab === "security" && (
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="font-semibold mb-1">Email</h3>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className={`badge mt-1 ${user?.is_email_verified ? "badge-success" : "badge-warning"}`}>
                {user?.is_email_verified ? "Verified" : "Not Verified"}
              </span>
            </div>
            <ChangePasswordForm />
          </div>
        )}
      </div>
    </>
  );
}


