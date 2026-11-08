import { useId } from "react";
import type { SupplementDetails } from "@/lib/supplement-details";

import { verifiedLabels } from "@/lib/verified-labels";

export function SupplementFormula({details,productId}: {details: SupplementDetails;productId?:string}) {
  const captionId=useId();
  const label=productId?verifiedLabels[productId]:null;
  return <div className="supplement-formula">
    <div className="supplement-ingredient-list"><strong>Ingredient statement</strong><p>{details.ingredients}</p></div>
    {!label&&details.amounts && <table className="supplement-amounts">
      <caption>Listed ingredient amounts</caption>
      <thead><tr><th scope="col">Ingredient</th><th scope="col">Amount</th></tr></thead>
      <tbody>{details.amounts.map(row => <tr key={row.ingredient}>
        <th scope="row">{row.ingredient}{row.detail && <small>{row.detail}</small>}</th>
        <td>{row.amount}</td>
      </tr>)}</tbody>
    </table>}
    {label&&<div className="verified-label-facts">
      <p><strong>Serving size:</strong> {label.serving}. <strong>Servings per container:</strong> {label.servings}.</p>
      {label.nutrition&&<table className="supplement-amounts verified-label-table" role="table" aria-colcount={3} aria-labelledby={captionId}>
        <caption id={captionId}>Label amounts per serving</caption>
        <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Nutrient</th><th role="columnheader" scope="col">Amount</th><th role="columnheader" scope="col">Daily Value</th></tr></thead>
        <tbody role="rowgroup">{label.nutrition.map(row=><tr role="row" key={row.name}>
          <th role="rowheader" scope="row">{row.name}{row.note&&<small>{row.note}</small>}</th>
          <td role="cell">{row.amount}</td><td role="cell">{row.dailyValue||"Not listed"}</td>
        </tr>)}</tbody>
      </table>}
    </div>}
    {!!details.allergens?.length && <div className="supplement-allergens"><strong>Allergen information</strong>{details.allergens.map(note => <p key={note}>{note}</p>)}</div>}
    {!!details.dietary.length && <ul className="supplement-dietary" aria-label="Product attributes">{details.dietary.map(item => <li key={item}>{item}</li>)}</ul>}
  </div>;
}

export function SupplementDirections({details}: {details: SupplementDetails}) {
  return <div className="supplement-directions">
    {details.directions.map(text => <p key={text}>{text}</p>)}
    {details.notes?.map(text => <p key={text}>{text}</p>)}
    {!!details.cautions.length && <div className="supplement-cautions"><strong>Before you begin</strong>{details.cautions.map(text => <p key={text}>{text}</p>)}</div>}
    {details.storage && <p className="supplement-storage"><strong>Storage</strong> {details.storage}</p>}
  </div>;
}
