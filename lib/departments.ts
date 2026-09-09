import type { Category } from "./catalog";

export const departmentHome = (department: Category) => department === "skincare" ? "/skincare" : "/";
export const departmentShop = (department: Category) => `/collections/${department}`;
export const formatSlug = (format: string) => format.toLowerCase().replace(/\s+/g, "-");
export const formatLabel = (format: string) => ({Powder:"Powders", Capsules:"Capsules", Sachets:"Sachets", Gummies:"Gummies", Cleanser:"Cleansers", Serum:"Serums", Moisturizer:"Moisturizers"}[format] || format);
export const formatOrder = ["Powder", "Capsules", "Sachets", "Gummies", "Cleanser", "Serum", "Moisturizer"];
export const formatHref = (department: Category, format: string) => `${departmentShop(department)}?format=${formatSlug(format)}`;
