import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/features/product/ProductCard";
import { ProductCardSkeleton, EmptyState, Pagination } from "@/components/ui";
import { useCategories, useProducts } from "@/hooks/useQueries";

export default function Search() {
  const [sp, setSP] = useSearchParams();
  const q = sp.get("q") || "";
  const categoryId = sp.get("category_id") || "";
  const [page, setPage] = useState(1);
  const initialSortParam = sp.get("sort") === "sold" ? "sold_count" : sp.get("sort") || "sold_count";
  const initialOrderParam = sp.get("order") || "desc";
  const initialSortKey =
    initialSortParam === "base_price" && initialOrderParam === "asc"
      ? "price_asc"
      : initialSortParam === "base_price" && initialOrderParam === "desc"
        ? "price_desc"
        : initialSortParam;
  const [sortKey, setSortKey] = useState(initialSortKey);

  const { data: categories = [] } = useCategories();
  const selectedCategory = Array.isArray(categories)
    ? categories.find((cat: any) => cat.id === categoryId)
    : null;
  const apiSort = sortKey === "sold" ? "sold_count" : sortKey === "price_asc" || sortKey === "price_desc" ? "base_price" : sortKey;
  const apiOrder = sortKey === "price_asc" ? "asc" : "desc";
  const productParams = {
    ...(q ? { q } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    page,
    limit: 24,
    sort: apiSort,
    order: apiOrder,
  };
  const { data, isLoading } = useProducts(productParams);

  useEffect(() => { setPage(1); }, [q, categoryId]);

  const sortOptions = [
    { label: "Best Selling", value: "sold_count" },
    { label: "Price: Low", value: "price_asc" },
    { label: "Price: High", value: "price_desc" },
    { label: "Newest", value: "created_at" },
    { label: "Top Rated", value: "rating" },
  ];

  const handleSort = (v: string) => {
    setSortKey(v);
    setPage(1);
  };

  return (
    <>
      <Helmet>
        <title>{selectedCategory ? `${selectedCategory.name} - ShopX` : q ? `"${q}" - Search ShopX` : "Search - ShopX"}</title>
      </Helmet>

      <div className="mx-auto w-full max-w-7xl px-3 py-4 text-gray-900 dark:text-gray-100 sm:px-4 sm:py-6 lg:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-950 dark:text-white">
              {selectedCategory ? selectedCategory.name : q ? `Results for "${q}"` : "All Products"}
            </h1>
            {data && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{data.total.toLocaleString()} products found</p>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Sort:</span>
            <div className="flex gap-1">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSort(opt.value)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    sortKey === opt.value
                      ? "border-primary-500 bg-primary-500 text-white shadow-sm"
                      : "border-gray-300 bg-white text-gray-700 hover:border-primary-400 hover:text-primary-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-primary-400 dark:hover:text-primary-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Array.from({ length: 24 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : data?.items.length === 0 ? (
          <EmptyState
            title="No products found"
            description={`We couldn't find anything for "${q}". Try different keywords.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <div className="mt-8">
              <Pagination
                page={page}
                pages={data?.pages ?? 1}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
