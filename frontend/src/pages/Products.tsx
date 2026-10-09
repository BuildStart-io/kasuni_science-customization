import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GraduationCap, Loader2, AlertTriangle, BookOpen, Layers, Presentation } from "lucide-react";
import VariationEditor, { type Variation } from "@/components/products/VariationEditor";
import ProductImageUpload from "@/components/products/ProductImageUpload";
import ProductVideoUpload from "@/components/products/ProductVideoUpload";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import LimitWarningBanner from "@/components/LimitWarningBanner";

export const CLASS_TYPES = [
  { id: "Theory and paper class", label: "Theory and paper class", icon: BookOpen, color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200" },
  { id: "Foundation class", label: "Foundation class", icon: Layers, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200" },
  { id: "Seminar for grade 11", label: "Seminar for grade 11", icon: Presentation, color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200" },
] as const;

export type ClassType = (typeof CLASS_TYPES)[number]["id"];

export const normalizeClassType = (type?: string | null): ClassType => {
  if (type === "Foundation class") return "Foundation class";
  if (type === "Seminar for grade 11") return "Seminar for grade 11";
  return "Theory and paper class";
};

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  delivery_price: number;
  product_type: string;
  class_type: string;
  grade: string | null;
  medium: string | null;
  recording_url: string | null;
  timetable: string | null;
  variations: unknown;
  images: string[];
  video_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId } = useStaffAccess();
  const { canAddProduct, usage, limits, isPaused } = usePlanLimits();
  const maxImages = limits?.max_images_per_product || 1;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [productType, setProductType] = useState("digital");
  const [classType, setClassType] = useState<ClassType>("Theory and paper class");
  const [grade, setGrade] = useState("");
  const [medium, setMedium] = useState<"sinhala" | "english" | "both">("sinhala");
  const [recordingUrl, setRecordingUrl] = useState("");
  const [timetable, setTimetable] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (error: any) {
      toast({
        title: "Error fetching classes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setDeliveryPrice("");
    setProductType("digital");
    setClassType("Theory and paper class");
    setGrade("");
    setMedium("sinhala");
    setRecordingUrl("");
    setTimetable("");
    setVariations([]);
    setImages([]);
    setVideoUrl(null);
    setIsActive(true);
    setEditingProduct(null);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice(product.price.toString());
    setDeliveryPrice(product.delivery_price?.toString() || "0");
    setProductType(product.product_type || "digital");
    setClassType(normalizeClassType(product.class_type));
    setGrade(product.grade || "");
    setMedium(((product.medium as any) === "english" || (product.medium as any) === "both") ? (product.medium as any) : "sinhala");
    setRecordingUrl(product.recording_url || "");
    setTimetable(product.timetable || "");
    setVariations(Array.isArray(product.variations) ? (product.variations as Variation[]) : []);
    setImages(Array.isArray(product.images) ? product.images : []);
    setVideoUrl(product.video_url || null);
    setIsActive(product.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const productData = {
        name,
        description: description || null,
        price: parseFloat(price),
        delivery_price: productType === "physical" ? parseFloat(deliveryPrice || "0") : 0,
        product_type: productType,
        class_type: classType,
        grade: grade.trim() || null,
        medium: medium || "sinhala",
        recording_url: recordingUrl.trim() || null,
        timetable: timetable.trim() || null,
        variations: variations as unknown as import("@/integrations/supabase/types").Json,
        images,
        video_url: videoUrl,
        is_active: isActive,
        user_id: effectiveUserId || user!.id,
      } as any;

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast({ title: "Class updated successfully" });
      } else {
        if (!canAddProduct) {
          toast({ title: "Class limit reached", description: `Your plan allows ${limits?.max_products} classes. Upgrade to add more.`, variant: "destructive" });
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from("products")
          .insert([productData]);

        if (error) throw error;
        toast({ title: "Class created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error saving class",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Class deleted successfully" });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error deleting class",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderClassTypeBadge = (type?: string | null) => {
    const config = CLASS_TYPES.find(t => t.id === type) || (
      type === "Theory class" || type === "Paper class" ? CLASS_TYPES[0] : {
        id: type || "Theory and paper class",
        label: type || "Theory and paper class",
        icon: BookOpen,
        color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200",
      }
    );
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`text-xs font-normal border ${config.color}`}>
        <Icon className="h-3 w-3 mr-1 inline" />
        {config.label}
      </Badge>
    );
  };

  const renderMediumBadge = (med?: string | null) => {
    const val = (med || "sinhala").toLowerCase();
    if (val === "english") {
      return (
        <Badge variant="outline" className="text-xs font-normal border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
          English Medium
        </Badge>
      );
    }
    if (val === "both") {
      return (
        <Badge variant="outline" className="text-xs font-normal border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
          Sinhala & English
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs font-normal border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
        සිංහල මාධ්‍ය
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <LimitWarningBanner type="products" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Classes</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage your class catalog: Theory & Paper classes, Foundation classes, and Seminars
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <div className="flex flex-col items-end">
              <DialogTrigger asChild>
                <Button disabled={isPaused || (!canAddProduct && !editingProduct)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Class
                </Button>
              </DialogTrigger>
              {!canAddProduct && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Limit reached ({usage?.products}/{limits?.max_products})
                </p>
              )}
            </div>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Class" : "Add New Class"}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? "Update the class details and curriculum settings" : "Create a new class for students and chatbot catalog"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Class Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Combined Maths Theory / Paper"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Monthly Fee / Price (LKR) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="2500.00"
                      required
                    />
                  </div>
                </div>

                {/* Class Type Toggle */}
                <div className="space-y-2">
                  <Label>Class Type *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-muted/60 rounded-lg border">
                    {CLASS_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = classType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setClassType(type.id)}
                          className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 text-center leading-tight ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Medium Selection Toggle */}
                <div className="space-y-2">
                  <Label>Medium (මාධ්‍යය) *</Label>
                  <div className="grid grid-cols-3 gap-2 p-1.5 bg-muted/60 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setMedium("sinhala")}
                      className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 text-center ${
                        medium === "sinhala"
                          ? "bg-emerald-600 text-white shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <span>සිංහල (Sinhala)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedium("english")}
                      className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 text-center ${
                        medium === "english"
                          ? "bg-blue-600 text-white shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <span>English</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedium("both")}
                      className={`py-2 px-3 text-xs sm:text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5 text-center ${
                        medium === "both"
                          ? "bg-purple-600 text-white shadow-sm font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      <span>Both (දෙකම)</span>
                    </button>
                  </div>
                </div>

                {/* Grade Input & Delivery Format */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade / Target Year</Label>
                    <Input
                      id="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g., Grade 11, Grade 12, 2026 A/L"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Delivery Format</Label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="digital">Online / Digital Access</SelectItem>
                        <SelectItem value="physical">Physical Class / Printed Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Timetable and Sample Class Recording URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timetable">Class Timetable / Schedule</Label>
                    <Input
                      id="timetable"
                      value={timetable}
                      onChange={(e) => setTimetable(e.target.value)}
                      placeholder="e.g., Saturday 8:00 AM - 10:30 AM"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recording-url">Sample Class Recording Link (URL)</Label>
                    <Input
                      id="recording-url"
                      value={recordingUrl}
                      onChange={(e) => setRecordingUrl(e.target.value)}
                      placeholder="e.g., https://youtu.be/... or Drive link"
                    />
                    <p className="text-xs text-muted-foreground">Sent to students asking for demo / sample class</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe syllabus coverage, timetable, notes, etc..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="active">Active (Available for registration)</Label>
                </div>

                {productType === "physical" && (
                  <div className="space-y-2">
                    <Label htmlFor="delivery-price">Material / Courier Delivery Fee (LKR)</Label>
                    <Input
                      id="delivery-price"
                      type="number"
                      step="0.01"
                      value={deliveryPrice}
                      onChange={(e) => setDeliveryPrice(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Postal/courier fee for printed tute packs</p>
                  </div>
                )}

                <VariationEditor variations={variations} onChange={setVariations} />

                <ProductImageUpload images={images} onChange={setImages} maxImages={maxImages} />

                <ProductVideoUpload videoUrl={videoUrl} onChange={setVideoUrl} />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingProduct ? (
                      "Update Class"
                    ) : (
                      "Create Class"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Class Catalog</CardTitle>
            <CardDescription>
              {products.length} class{products.length !== 1 ? "es" : ""} in your catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No classes yet. Add your first class to get started.</p>
              </div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="space-y-3 md:hidden">
                  {products.map((product) => (
                    <div key={product.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {renderClassTypeBadge(product.class_type)}
                            {renderMediumBadge(product.medium)}
                            {product.grade && (
                              <Badge variant="outline" className="text-xs font-normal">
                                {product.grade}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          product.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <p className="font-medium">LKR {product.price.toFixed(2)}</p>
                          {product.product_type === "physical" && product.delivery_price > 0 && (
                            <p className="text-xs text-muted-foreground">+LKR {product.delivery_price.toFixed(2)} delivery</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class Name</TableHead>
                        <TableHead>Class Type</TableHead>
                        <TableHead>Grade / Year</TableHead>
                        <TableHead>Medium</TableHead>
                        <TableHead>Fee / Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            <div>
                              <span>{product.name}</span>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {renderClassTypeBadge(product.class_type)}
                          </TableCell>
                          <TableCell>
                            {product.grade ? (
                              <Badge variant="outline">{product.grade}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {renderMediumBadge(product.medium)}
                          </TableCell>
                          <TableCell>
                            LKR {product.price.toFixed(2)}
                            {product.product_type === "physical" && product.delivery_price > 0 && (
                              <span className="block text-xs text-muted-foreground">+LKR {product.delivery_price.toFixed(2)} delivery</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              product.is_active ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {product.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
