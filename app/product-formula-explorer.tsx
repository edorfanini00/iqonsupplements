import { type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { IngredientMark } from "./product-formula-visual";

export function ProductFormulaExplorer({ product }: { product: Product }) {
  const ingredients = productContent[product.id]?.ingredients || [];
  if (!ingredients.length) return null;
  return <div className={`ingredient-cards ingredient-count-${ingredients.length}`}>
    {ingredients.map((item,i)=><article className="ingredient-card" key={item.name}>
      <IngredientMark name={item.name} index={i}/>
      <div className="ingredient-card-copy"><p className="ingredient-role">{item.role}</p><h3>{item.name}</h3>{item.amount && <strong className="ingredient-amount">{item.amount}</strong>}<p>{item.detail}</p></div>
    </article>)}
  </div>;
}
