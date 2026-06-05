import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import ProductCard from "@/components/features/product/ProductCard";
import api from "@/services/api";
import { useProducts } from "@/hooks/useQueries";
import type { Product } from "@/types";

type HomeSlide = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  ctaText?: string | null;
  ctaHref?: string | null;
  enabled?: boolean;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
};

const DEFAULT_SLIDES: HomeSlide[] = [
  {
    id: "default-1",
    title: "Shop Everything. Anytime.",
    subtitle: "Millions of products - Best prices - Fast delivery",
    imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80",
    ctaText: "Shop now",
    ctaHref: "/search",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [slideIndex, setSlideIndex] = useState(0);
  const [slides, setSlides] = useState<HomeSlide[]>(DEFAULT_SLIDES);
  const { data: productsData, isLoading } = useProducts({ page: 1, limit: 12, sort: "created_at", order: "desc" });

  const products: Product[] = productsData?.items || [];
  const activeSlide = slides[slideIndex] || slides[0] || DEFAULT_SLIDES[0];

  useEffect(() => {
    let alive = true;
    api
      .get<ApiEnvelope<HomeSlide[]> | HomeSlide[]>("/homepage/slides")
      .then((response) => {
        const payload = Array.isArray(response.data) ? response.data : response.data.data;
        const nextSlides = Array.isArray(payload) && payload.length ? payload : DEFAULT_SLIDES;
        if (alive) {
          setSlides(nextSlides);
          setSlideIndex(0);
        }
      })
      .catch(() => {
        if (alive) setSlides(DEFAULT_SLIDES);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    navigate(text ? `/search?q=${encodeURIComponent(text)}` : "/search");
  };

  const nextSlide = () => setSlideIndex((current) => (current + 1) % slides.length);
  const prevSlide = () => setSlideIndex((current) => (current - 1 + slides.length) % slides.length);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-gray-100">
      <section className="relative isolate min-h-[360px] overflow-hidden border-b border-gray-200 dark:border-slate-800 md:min-h-[460px]">
        <img src={activeSlide.imageUrl} alt={activeSlide.title} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/82 via-slate-950/52 to-slate-950/16 dark:from-slate-950/92 dark:via-slate-950/68 dark:to-slate-950/28" />
        <div className="mx-auto flex min-h-[360px] max-w-7xl flex-col justify-center px-4 py-12 sm:px-6 md:min-h-[460px] lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">{activeSlide.title}</h1>
            {activeSlide.subtitle && <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-xl">{activeSlide.subtitle}</p>}
            <form onSubmit={submitSearch} className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for anything..."
                  className="h-12 w-full rounded-lg border border-white/35 bg-white/92 pl-12 pr-4 text-gray-950 shadow-lg outline-none ring-orange-500/40 placeholder:text-gray-500 focus:border-orange-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-900/88 dark:text-white dark:placeholder:text-slate-400"
                />
              </div>
              <button type="submit" className="btn btn-primary h-12 px-8 shadow-lg shadow-orange-500/20">
                Search
              </button>
            </form>
            {activeSlide.ctaHref && (
              <Link to={activeSlide.ctaHref} className="mt-5 inline-flex h-11 items-center rounded-lg bg-orange-500 px-5 font-semibold text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600">
                {activeSlide.ctaText || "Shop now"}
              </Link>
            )}
          </div>
        </div>
        {slides.length > 1 && (
          <>
            <button type="button" aria-label="Previous slide" onClick={prevSlide} className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white hover:bg-slate-900 md:flex">
              <ChevronLeft size={22} />
            </button>
            <button type="button" aria-label="Next slide" onClick={nextSlide} className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-slate-950/55 text-white hover:bg-slate-900 md:flex">
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`Go to slide ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${index === slideIndex ? "w-8 bg-orange-500" : "w-2.5 bg-white/50 hover:bg-white"}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-950 dark:text-white">Latest Products</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">Fresh items from ShopX sellers</p>
          </div>
          <Link to="/search" className="text-sm font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">See all</Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-900" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </main>
    </div>
  );
}


