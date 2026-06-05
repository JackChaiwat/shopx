import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, Package, Eye, BarChart2, Upload, ArrowUp, ArrowDown, Image, Star } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMyShop, useCategories, useBrands } from "@/hooks/useQueries";
import { ConfirmDialog, Input, Select, Textarea, Modal, Spinner, EmptyState, Pagination } from "@/components/ui";
import { formatPrice, formatNumber } from "@/utils";
import api from "@/services/api";
import toast from "react-hot-toast";

interface ProductForm {
  name: string; description: string; short_description: string;
  base_price: string; sale_price: string; stock_quantity: string;
  category_id: string; brand_id: string; sku: string; weight: string;
  status: "draft" | "active" | "inactive";
  tags: string;
}

interface ProductImageItem {
  id: string;
  url: string;
  is_primary: boolean;
}

interface SellerProduct {
  id: string;
  name: string;
  sku?: string;
  images?: ProductImageItem[];
  category_id?: string;
  [key: string]: any;
}

type ConfirmState = {
  title: string;
  message?: string;
  confirmText?: string;
  variant?: "primary" | "danger";
  onConfirm: () => Promise<void> | void;
};

export default function SellerProducts() {
  const { data: shop } = useMyShop();
  const { data: categories } = useCategories();
  const { data: brands } = useBrands();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [analyticsModal, setAnalyticsModal] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [stockProduct, setStockProduct] = useState<SellerProduct | null>(null);
  const [stockMode, setStockMode] = useState<"add" | "set">("add");
  const [stockAmount, setStockAmount] = useState("1");
  const [savingStock, setSavingStock] = useState(false);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["seller-products-manage", shop?.id, page, filterStatus, searchQ, sortBy, sortOrder],
    queryFn: async () => {
      const r = await api.get("/products", {
        params: { shop_id: shop?.id, page, limit: 20, status: filterStatus || undefined, q: searchQ || undefined, sort: sortBy, order: sortOrder },
      });
      return r.data.data;
    },
    enabled: !!shop,
  });

  const { data: productAnalytics } = useQuery({
    queryKey: ["seller-product-analytics"],
    queryFn: async () => { const r = await api.get("/shops/my/analytics/products"); return r.data.data; },
    enabled: !!shop && analyticsModal !== null,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductForm>({
    defaultValues: { status: "draft", stock_quantity: "0" },
  });
  const selectedCategoryId = watch("category_id");
  const selectedProduct = productsData?.items?.find((p: SellerProduct) => p.id === imageModal) as SellerProduct | undefined;

  useEffect(() => {
    if (editingId || !selectedCategoryId) return;
    let ignore = false;
    api.get("/products/sku-preview", { params: { category_id: selectedCategoryId } })
      .then(r => {
        if (!ignore) setValue("sku", r.data.data.sku);
      })
      .catch(() => undefined);
    return () => { ignore = true; };
  }, [editingId, selectedCategoryId, setValue]);

  const openNew = () => {
    reset({ status: "draft", stock_quantity: "0", base_price: "", sale_price: "", weight: "", tags: "", sku: "", category_id: "" });
    setEditingId(null);
    setProductImageFiles([]);
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setValue("name", p.name); setValue("description", p.description || "");
    setValue("short_description", p.short_description || ""); setValue("base_price", p.base_price);
    setValue("sale_price", p.sale_price || ""); setValue("stock_quantity", String(p.stock_quantity));
    setValue("category_id", p.category_id || ""); setValue("brand_id", p.brand_id || "");
    setValue("sku", p.sku || ""); setValue("status", p.status);
    setValue("weight", p.weight || ""); setValue("tags", (p.tags || []).join(", "));
    setEditingId(p.id);
    setProductImageFiles([]);
    setShowForm(true);
  };

  const uploadProductImages = async (productId: string, files: File[]) => {
    for (let i = 0; i < files.length; i += 1) {
      const form = new FormData();
      form.append("file", files[i]);
      form.append("is_primary", String(i === 0));
      await api.post(`/products/${productId}/images`, form);
    }
  };

  const onSubmit = async (data: ProductForm) => {
    const payload = {
      name: data.name, description: data.description, short_description: data.short_description,
      base_price: parseFloat(data.base_price),
      sale_price: data.sale_price ? parseFloat(data.sale_price) : undefined,
      stock_quantity: parseInt(data.stock_quantity),
      category_id: data.category_id || undefined, brand_id: data.brand_id || undefined,
      sku: data.sku || undefined, status: data.status,
      weight: data.weight ? parseFloat(data.weight) : undefined,
      tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
    };
    try {
      if (editingId) {
        await api.patch(`/products/${editingId}`, payload);
        if (productImageFiles.length) await uploadProductImages(editingId, productImageFiles);
        toast.success(productImageFiles.length ? "Product updated and images uploaded" : "Product updated");
      } else {
        const res = await api.post("/products", payload);
        const productId = res.data.data.id;
        if (productImageFiles.length) await uploadProductImages(productId, productImageFiles);
        toast.success(productImageFiles.length ? "Product created with images" : "Product created");
      }
      qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
      setProductImageFiles([]);
      setShowForm(false);
    } catch (e: any) { toast.error(e?.response?.data?.error?.message || "Failed to save"); }
  };


  const openStockModal = (product: SellerProduct) => {
    setStockProduct(product);
    setStockMode("add");
    setStockAmount("1");
  };

  const saveStock = async () => {
    if (!stockProduct) return;
    const amount = Number.parseInt(stockAmount, 10);
    if (!Number.isFinite(amount) || amount < 0 || (stockMode === "add" && amount === 0)) {
      toast.error(stockMode === "add" ? "Enter stock to add" : "Stock must be 0 or more");
      return;
    }
    setSavingStock(true);
    try {
      await api.patch(`/products/${stockProduct.id}/stock`, stockMode === "add"
        ? { quantity_delta: amount, reason: "seller_add_stock" }
        : { stock_quantity: amount, reason: "seller_set_stock" }
      );
      toast.success(stockMode === "add" ? "Stock added" : "Stock updated");
      setStockProduct(null);
      qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to update stock");
    } finally {
      setSavingStock(false);
    }
  };

  const deleteProduct = (id: string) => {
    setConfirmDialog({
      title: "Delete product",
      message: "Delete this product? This cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/products/${id}`);
          toast.success("Product deleted");
          qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
        } catch { toast.error("Failed to delete"); }
      },
    });
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const r = await api.post("/categories", { name });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      setValue("category_id", r.data.data.id);
      setNewCategoryName("");
      toast.success("Category created");
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const startEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const updateCategory = async () => {
    const name = editingCategoryName.trim();
    if (!editingCategoryId || !name) return;
    setSavingCategory(true);
    try {
      await api.patch(`/categories/${editingCategoryId}`, { name });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated");
      cancelEditCategory();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || "Failed to update category");
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = (categoryId: string) => {
    setConfirmDialog({
      title: "Delete category",
      message: "Delete this category?",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
      await api.delete(`/categories/${categoryId}`);
      await qc.invalidateQueries({ queryKey: ["categories"] });
      await qc.invalidateQueries({ queryKey: ["products"] });
      if (selectedCategoryId === categoryId) setValue("category_id", "");
      toast.success("Category deleted");
    } catch (e: any) {
      const message = e?.response?.data?.error?.message || "Failed to delete category";
      if (
        e?.response?.status === 400 &&
        String(message).toLowerCase().includes("used by products") &&
        confirm("This category is used by products. Remove this category from those products, then delete it?")
      ) {
        try {
          await api.delete(`/categories/${categoryId}`, { params: { detach_products: true } });
          await qc.invalidateQueries({ queryKey: ["categories"] });
          await qc.invalidateQueries({ queryKey: ["products"] });
          if (selectedCategoryId === categoryId) setValue("category_id", "");
          toast.success("Category deleted. Products were kept without a category.");
        } catch (detachError: any) {
          toast.error(detachError?.response?.data?.error?.message || "Failed to delete category");
        }
        return;
      }
      toast.error(message);
        }
      },
    });
  };

  const uploadImage = async (productId: string, file: File, isPrimary = false) => {
    const form = new FormData();
    form.append("file", file);
    form.append("is_primary", String(isPrimary));
      try {
      await api.post(`/products/${productId}/images`, form);
      toast.success("Image uploaded");
      qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
    } catch { toast.error("Image upload failed"); }
  };

  const setPrimaryImage = async (productId: string, imageId: string) => {
    try {
      await api.patch(`/products/${productId}/images/${imageId}/primary`);
      toast.success("Primary image updated");
      qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
    } catch { toast.error("Failed to update primary image"); }
  };

  const deleteImage = (productId: string, imageId: string) => {
    setConfirmDialog({
      title: "Delete image",
      message: "Delete this product image?",
      confirmText: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await api.delete(`/products/${productId}/images/${imageId}`);
          toast.success("Image deleted");
          qc.invalidateQueries({ queryKey: ["seller-products-manage"] });
        } catch { toast.error("Failed to delete image"); }
      },
    });
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    sortBy === col ? (sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : null
  );

  const statusColor: Record<string, string> = {
    active: "badge-success", draft: "badge-warning", inactive: "badge-danger", out_of_stock: "badge-danger",
  };

  return (
    <>
      <Helmet><title>My Products — Seller</title></Helmet>
      <div className="max-w-[1300px] mx-auto w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6">

        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Products</h1>
            {productsData && <p className="text-sm text-gray-500">{productsData.total} products total</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAnalyticsModal("open")} className="btn btn-secondary btn-sm">
              <BarChart2 size={14} /> Analytics
            </button>
            <button onClick={openNew} className="btn btn-primary btn-sm"><Plus size={14} /> Add Product</button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1); }}
            placeholder="Search products..." className="input text-sm py-1.5 flex-1 min-w-48" />
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="input text-sm py-1.5 w-32">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Status summary pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["active","draft","inactive","out_of_stock"].map(s => {
            const count = productsData?.items?.filter((p: any) => p.status === s).length || 0;
            return count > 0 ? (
              <button key={s} onClick={() => setFilterStatus(s === filterStatus ? "" : s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${filterStatus === s ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900" : "border-gray-200 text-gray-600"}`}>
                {s} ({count})
              </button>
            ) : null;
          })}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-primary-500" /></div>
        ) : !productsData?.items?.length ? (
          <EmptyState icon={<Package size={48} />} title="No products yet"
            description="Add your first product to start selling"
            action={<button onClick={openNew} className="btn btn-primary"><Plus size={15} /> Add Product</button>} />
        ) : (
          <>
            <div className="card overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort("base_price")}>
                      Price <SortIcon col="base_price" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort("stock_quantity")}>
                      Stock <SortIcon col="stock_quantity" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort("sold_count")}>
                      Sold <SortIcon col="sold_count" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell cursor-pointer hover:text-primary-600"
                      onClick={() => toggleSort("view_count")}>
                      Views <SortIcon col="view_count" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Rating</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {productsData.items.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                            {p.primary_image
                              ? <img src={p.primary_image} alt="" className="w-full h-full object-cover" />
                              : <Package size={16} className="m-auto mt-2 text-gray-300" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium line-clamp-1">{p.name}</p>
                            <p className="text-xs text-gray-400">{p.sku || "No SKU"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="font-medium">{formatPrice(p.sale_price || p.base_price)}</p>
                        {p.sale_price && <p className="text-xs text-gray-400 line-through">{formatPrice(p.base_price)}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={p.stock_quantity <= 5 ? "text-red-500 font-medium" : p.stock_quantity <= 20 ? "text-yellow-600 font-medium" : ""}>
                          {p.stock_quantity}
                        </span>
                        {p.stock_quantity <= 5 && p.stock_quantity > 0 && <span className="text-xs text-red-400 ml-1">Low</span>}
                        {p.stock_quantity === 0 && <span className="text-xs text-red-500 ml-1">Out</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{formatNumber(p.sold_count)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{formatNumber(p.view_count || 0)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Star size={13} className="fill-yellow-400 text-yellow-400" />
                          <span>{parseFloat(p.rating).toFixed(1)}</span>
                          <span className="text-xs text-gray-400">({p.review_count})</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${statusColor[p.status] || "badge-info"}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openStockModal(p)} title="Add stock"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-green-500">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => setImageModal(p.id)} title="Manage images"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500">
                            <Upload size={14} />
                          </button>
                          <button onClick={() => openEdit(p)} title="Edit"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={productsData.pages} onChange={setPage} />
          </>
        )}

        {/* Add/Edit product modal */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? "Edit Product" : "New Product"}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <Input label="Product Name *" {...register("name", { required: "Required" })} error={errors.name?.message} />
            <Input label="Short Description" {...register("short_description")} placeholder="One-line summary" />
            <Textarea label="Full Description (HTML supported)" {...register("description")} rows={4} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Base Price (฿) *" type="number" step="0.01" min="0"
                {...register("base_price", { required: "Required", min: { value: 0.01, message: "Must be > 0" } })}
                error={errors.base_price?.message} />
              <Input label="Sale Price (฿)" type="number" step="0.01" min="0" {...register("sale_price")} />
              <Input label="Stock Quantity" type="number" min="0" {...register("stock_quantity")} />
              <Input label="Weight (kg)" type="number" step="0.001" {...register("weight")} />
              <Input label="SKU" {...register("sku")} placeholder="Auto-generated from category" readOnly className="bg-gray-50 dark:bg-gray-800" />
              <Select label="Status" {...register("status")}>
                <option value="draft">Draft</option>
                <option value="active">Active (visible to buyers)</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Select label="Category" {...register("category_id")}>
                <option value="">— No category —</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="input text-sm py-2"
                  placeholder="Add new category, e.g. Electronics"
                />
                <button type="button" onClick={createCategory} disabled={creatingCategory || !newCategoryName.trim()} className="btn btn-secondary btn-sm shrink-0">
                  <Plus size={14} /> Add
                </button>
              </div>
              <p className="text-xs text-gray-400">SKU is generated from the category code and must start with English letters.</p>
              {!!categories?.length && (
                <div className="rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 max-h-44 overflow-y-auto">
                  {categories.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                      {editingCategoryId === c.id ? (
                        <>
                          <input
                            value={editingCategoryName}
                            onChange={e => setEditingCategoryName(e.target.value)}
                            className="input text-sm py-1.5 flex-1"
                          />
                          <button type="button" onClick={updateCategory} disabled={savingCategory || !editingCategoryName.trim()} className="btn btn-primary btn-sm">
                            Save
                          </button>
                          <button type="button" onClick={cancelEditCategory} className="btn btn-secondary btn-sm">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.slug}</p>
                          </div>
                          <button type="button" onClick={() => startEditCategory(c)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600">
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => deleteCategory(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Select label="Brand" {...register("brand_id")}>
              <option value="">— No brand —</option>
              {brands?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <div>
              <label className="block text-sm font-medium mb-1">Product Images</label>
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-4">
                {productImageFiles.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                    {productImageFiles.map((file, index) => (
                      <div key={`${file.name}-${file.lastModified}`} className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full aspect-square object-cover" />
                        {index === 0 && (
                          <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-500 text-white">
                            Primary
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setProductImageFiles(files => files.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                          title="Remove image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-400">JPEG, PNG, WebP · first image becomes primary</p>
                  <label className="btn btn-secondary btn-sm cursor-pointer">
                    <Upload size={14} /> Choose Images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        setProductImageFiles(prev => [...prev, ...files]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            <Input label="Tags (comma-separated)" {...register("tags")} placeholder="e.g. electronics, wireless, premium" />
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
                {isSubmitting ? <Spinner className="w-4 h-4" /> : editingId ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </form>
        </Modal>

        {/* Image upload modal */}
        <Modal open={!!imageModal} onClose={() => setImageModal(null)} title="Product Images">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {selectedProduct?.name ? `Current images for ${selectedProduct.name}` : "Upload and manage product images."}
            </p>
            {selectedProduct?.images?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedProduct.images.map(img => (
                  <div key={img.id} className="relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
                    <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                    {img.is_primary && (
                      <span className="absolute top-2 left-2 text-[11px] px-2 py-0.5 rounded-full bg-primary-500 text-white flex items-center gap-1">
                        <Star size={10} className="fill-white" /> Primary
                      </span>
                    )}
                    <div className="flex items-center gap-1 p-2">
                      <button type="button" onClick={() => imageModal && setPrimaryImage(imageModal, img.id)}
                        disabled={img.is_primary}
                        className="btn btn-secondary btn-sm flex-1 text-xs">
                        Main
                      </button>
                      <button type="button" onClick={() => imageModal && deleteImage(imageModal, img.id)}
                        className="btn btn-secondary btn-sm text-red-500 px-2">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-5 text-center text-sm text-gray-400">
                <Image size={28} className="mx-auto mb-2 opacity-50" />
                No images uploaded yet
              </div>
            )}
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
              <Upload size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 mb-3">Click to upload or drag & drop</p>
              <p className="text-xs text-gray-400 mb-3">JPEG, PNG, WebP · Max 10MB each</p>
              <div className="flex gap-2 justify-center">
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  Upload Image
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && imageModal) uploadImage(imageModal, f, false);
                    e.target.value = "";
                  }} />
                </label>
                <label className="btn btn-primary btn-sm cursor-pointer">
                  Set as Primary
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && imageModal) uploadImage(imageModal, f, true);
                    e.target.value = "";
                  }} />
                </label>
              </div>
            </div>
          </div>
        </Modal>


        {/* Stock adjustment modal */}
        <Modal open={!!stockProduct} onClose={() => setStockProduct(null)} title="Update Stock">
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                {stockProduct?.primary_image
                  ? <img src={stockProduct.primary_image} alt="" className="w-full h-full object-cover" />
                  : <Package size={18} className="m-auto mt-3 text-gray-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium line-clamp-1">{stockProduct?.name}</p>
                <p className="text-xs text-gray-400">Current stock: {stockProduct?.stock_quantity ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-1">
              <button type="button" onClick={() => setStockMode("add")}
                className={`rounded-md px-3 py-2 text-sm font-medium ${stockMode === "add" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500"}`}>
                Add stock
              </button>
              <button type="button" onClick={() => setStockMode("set")}
                className={`rounded-md px-3 py-2 text-sm font-medium ${stockMode === "set" ? "bg-white dark:bg-gray-700 shadow-sm text-primary-600" : "text-gray-500"}`}>
                Set stock
              </button>
            </div>

            <Input
              label={stockMode === "add" ? "Quantity to add" : "New stock quantity"}
              type="number"
              min={stockMode === "add" ? 1 : 0}
              value={stockAmount}
              onChange={e => setStockAmount(e.target.value)}
            />

            {stockMode === "add" && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-2 text-sm">
                New stock will be {(stockProduct?.stock_quantity ?? 0) + (Number.parseInt(stockAmount, 10) || 0)}.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button type="button" onClick={() => setStockProduct(null)} className="btn btn-secondary btn-sm">Cancel</button>
              <button type="button" onClick={saveStock} disabled={savingStock} className="btn btn-primary btn-sm">
                {savingStock ? <Spinner className="w-4 h-4" /> : "Save Stock"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Analytics modal */}
        <Modal open={!!analyticsModal} onClose={() => setAnalyticsModal(null)} title="Product Analytics">
          <div className="space-y-3">
            {productAnalytics?.length ? productAnalytics.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.views} views · {p.conversion}% conversion</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{p.sold} sold</p>
                  <p className="text-xs text-gray-400 flex items-center justify-end gap-1"><Star size={11} className="fill-yellow-400 text-yellow-400" /> {p.rating}</p>
                </div>
              </div>
            )) : <p className="text-sm text-gray-400 text-center py-4">No analytics data yet</p>}
          </div>
        </Modal>
        <ConfirmDialog
          open={!!confirmDialog}
          title={confirmDialog?.title || ""}
          message={confirmDialog?.message}
          confirmText={confirmDialog?.confirmText}
          variant={confirmDialog?.variant}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog?.onConfirm;
            setConfirmDialog(null);
            void action?.();
          }}
        />
      </div>
    </>
  );
}
