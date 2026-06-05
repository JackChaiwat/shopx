import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Image as ImageIcon, Link as LinkIcon, MapPin, Navigation, Plus, Save, Store, Trash2, Upload } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import api from "@/services/api";
import { useMyShop } from "@/hooks/useQueries";
import { Input, Spinner, Textarea } from "@/components/ui";
import MapPinPicker from "@/components/MapPinPicker";

type ShopForm = {
  name: string;
  description: string;
  logo_url: string;
  banner_url: string;
  phone: string;
  email: string;
  address: string;
  latitude: string;
  longitude: string;
};

type HomeSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  ctaText?: string | null;
  ctaHref?: string | null;
  sortOrder?: number;
  enabled: boolean;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
};

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80";

const emptySlide = (): HomeSlide => ({
  id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: "New banner",
  subtitle: "Add a short message for customers",
  imageUrl: "",
  ctaText: "Shop now",
  ctaHref: "/search",
  enabled: true,
});

const getErrorMessage = (error: unknown) => {
  const anyError = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return anyError.response?.data?.error?.message || anyError.message || "Something went wrong";
};

export default function SellerSettings() {
  const queryClient = useQueryClient();
  const { data: shop, isLoading } = useMyShop();
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [slides, setSlides] = useState<HomeSlide[]>([]);

  const updateShop = useMutation({
    mutationFn: async (data: ShopForm) => {
      const response = await api.patch("/shops/my", {
        name: data.name,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        latitude: data.latitude ? Number(data.latitude) : null,
        longitude: data.longitude ? Number(data.longitude) : null,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shop"] });
    },
  });

  const defaultValues = useMemo<ShopForm>(
    () => ({
      name: shop?.name || "",
      description: shop?.description || "",
      logo_url: shop?.logo_url || "",
      banner_url: shop?.banner_url || "",
      phone: shop?.phone || "",
      email: shop?.email || "",
      address: shop?.address || "",
      latitude: shop?.latitude || "",
      longitude: shop?.longitude || "",
    }),
    [shop]
  );

  const { register, handleSubmit, reset, setValue, watch } = useForm<ShopForm>({ values: defaultValues });
  const shopLatitude = watch("latitude");
  const shopLongitude = watch("longitude");

  const slidesQuery = useQuery({
    queryKey: ["homepage-slides-manage"],
    queryFn: async () => {
      const response = await api.get<ApiEnvelope<HomeSlide[]> | HomeSlide[]>("/homepage/slides/manage");
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    },
  });

  useEffect(() => {
    if (slidesQuery.data) {
      setSlides(slidesQuery.data.length ? slidesQuery.data : [{ ...emptySlide(), imageUrl: SAMPLE_IMAGE, title: "Shop Everything. Anytime." }]);
    }
  }, [slidesQuery.data]);

  const saveSlides = useMutation({
    mutationFn: async (nextSlides: HomeSlide[]) => {
      const response = await api.put<ApiEnvelope<HomeSlide[]> | HomeSlide[]>("/homepage/slides", {
        slides: nextSlides.map((slide, index) => ({
          title: slide.title.trim() || "Homepage slide",
          subtitle: slide.subtitle?.trim() || null,
          image_url: slide.imageUrl.trim(),
          cta_text: slide.ctaText?.trim() || null,
          cta_href: slide.ctaHref?.trim() || null,
          sort_order: index,
          is_enabled: slide.enabled,
        })),
      });
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    },
    onSuccess: (saved) => {
      setSlides(saved);
      queryClient.invalidateQueries({ queryKey: ["homepage-slides-manage"] });
      toast.success("Homepage slides saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const onSubmit = async (data: ShopForm) => {
    try {
      await updateShop.mutateAsync(data);
      toast.success("Shop settings saved");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const uploadShopImage = async (file: File, field: "logo_url" | "banner_url") => {
    const formData = new FormData();
    formData.append("file", file);
    field === "logo_url" ? setLogoUploading(true) : setBannerUploading(true);
    try {
      const endpoint = field === "logo_url" ? "/shops/my/logo" : "/shops/my/banner";
      const response = await api.post(endpoint, formData);
      const url = response.data.data?.[field];
      if (url) setValue(field, url, { shouldDirty: true });
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      field === "logo_url" ? setLogoUploading(false) : setBannerUploading(false);
    }
  };

  const updateSlide = (id: string, patch: Partial<HomeSlide>) => {
    setSlides((current) => current.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)));
  };

  const removeSlide = (id: string) => {
    setSlides((current) => (current.length > 1 ? current.filter((slide) => slide.id !== id) : current));
  };

  const submitSlides = () => {
    if (!slides.length) {
      toast.error("Add at least one slide");
      return;
    }
    const invalid = slides.find((slide) => !slide.imageUrl.trim() || !/^https?:\/\//.test(slide.imageUrl.trim()));
    if (invalid) {
      toast.error("Every slide needs an image URL starting with http:// or https://");
      return;
    }
    saveSlides.mutate(slides);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 text-gray-900 dark:text-gray-100 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-950 dark:text-gray-950 dark:text-white">Seller Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 dark:text-slate-400">Manage shop information and homepage banners.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="mb-5 flex items-center gap-2 text-gray-950 dark:text-gray-950 dark:text-white">
          <Store className="h-5 w-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Shop Profile</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Shop Name" {...register("name", { required: true })} />
          <Input label="Email" {...register("email")} />
          <Input label="Phone" {...register("phone")} />
          <Input label="Address" {...register("address")} />
          <input type="hidden" {...register("latitude")} />
          <input type="hidden" {...register("longitude")} />
          <div className="md:col-span-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100">
            <div className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="font-semibold">Shipping origin</p>
                <p className="mt-1 text-xs opacity-80">Drag the map until the pin is on your shop. This is used as the shipping origin for delivery distance.</p>
                <div className="mt-3">
                  <MapPinPicker
                    latitude={shopLatitude}
                    longitude={shopLongitude}
                    onChange={(lat, lng) => {
                      setValue("latitude", lat, { shouldDirty: true });
                      setValue("longitude", lng, { shouldDirty: true });
                    }}
                    heightClass="h-64"
                  />
                </div>
                {shopLatitude && shopLongitude && (
                  <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline" href={`https://www.google.com/maps?q=${shopLatitude},${shopLongitude}`} target="_blank" rel="noreferrer">
                    <Navigation size={13} /> View shop pin in Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <Textarea label="Description" rows={4} {...register("description")} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-950 dark:text-white">Logo</label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                {watch("logo_url") ? <img src={watch("logo_url")} alt="Logo" className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-400 dark:text-gray-500 dark:text-slate-500" />}
              </div>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {logoUploading ? <Spinner className="h-4 w-4 text-gray-950 dark:text-white" /> : <Upload size={16} />}
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadShopImage(e.target.files[0], "logo_url")} />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-gray-950 dark:text-white">Banner</label>
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                {watch("banner_url") ? <img src={watch("banner_url")} alt="Banner" className="h-full w-full object-cover" /> : <ImageIcon className="text-gray-400 dark:text-gray-500 dark:text-slate-500" />}
              </div>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {bannerUploading ? <Spinner className="h-4 w-4 text-gray-950 dark:text-white" /> : <Upload size={16} />}
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadShopImage(e.target.files[0], "banner_url")} />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => reset(defaultValues)}>
            Reset
          </button>
          <button type="submit" className="btn btn-primary" disabled={updateShop.isPending}>
            <Save size={16} />
            Save Shop
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">\n        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950 dark:text-gray-950 dark:text-white">Homepage Slides</h2>
            <p className="text-sm text-gray-500 dark:text-gray-500 dark:text-slate-400">Use image URLs. These banners appear on the homepage hero slider.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setSlides((current) => [...current, emptySlide()])}>
            <Plus size={16} />
            Add Slide
          </button>
        </div>

        {slidesQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div key={slide.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold text-gray-950 dark:text-gray-950 dark:text-white">
                    <ImageIcon size={18} className="text-orange-400" />
                    Slide {index + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-700 dark:text-slate-300">
                      <input type="checkbox" checked={slide.enabled} onChange={(event) => updateSlide(slide.id, { enabled: event.target.checked })} />
                      Enabled
                    </label>
                    <button type="button" className="rounded-lg bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20" onClick={() => removeSlide(slide.id)} disabled={slides.length <= 1} aria-label="Remove slide">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex aspect-video items-center justify-center">
                      {slide.imageUrl ? <img src={slide.imageUrl} alt={slide.title} className="h-full w-full object-cover" /> : <ImageIcon className="h-9 w-9 text-gray-500 dark:text-slate-500" />}
                    </div>
                    <div className="flex gap-2 p-2">
                      <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => updateSlide(slide.id, { imageUrl: SAMPLE_IMAGE })}>Sample</button>
                      <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => updateSlide(slide.id, { imageUrl: "" })}>Clear</button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Input label="Image URL" value={slide.imageUrl} onChange={(event) => updateSlide(slide.id, { imageUrl: event.target.value })} placeholder="https://..." />
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500 dark:text-slate-500"><LinkIcon size={12} /> Paste a hosted image URL.</p>
                    </div>
                    <Input label="Title" value={slide.title} onChange={(event) => updateSlide(slide.id, { title: event.target.value })} />
                    <Input label="Subtitle" value={slide.subtitle || ""} onChange={(event) => updateSlide(slide.id, { subtitle: event.target.value })} />
                    <Input label="Button Text" value={slide.ctaText || ""} onChange={(event) => updateSlide(slide.id, { ctaText: event.target.value })} />
                    <Input label="Button Link" value={slide.ctaHref || ""} onChange={(event) => updateSlide(slide.id, { ctaHref: event.target.value })} placeholder="/search" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => setSlides(slidesQuery.data || [{ ...emptySlide(), imageUrl: SAMPLE_IMAGE }])}>
            Reset Slides
          </button>
          <button type="button" className="btn btn-primary" onClick={submitSlides} disabled={saveSlides.isPending}>
            <Save size={16} />
            Save Slides
          </button>
        </div>
      </section>
    </div>
  );
}
