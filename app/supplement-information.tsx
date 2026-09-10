import type { SupplementDetails } from "@/lib/supplement-details";

export function SupplementFormula({details, showFullIngredients = true}: {details: SupplementDetails; showFullIngredients?: boolean}) {
  return <div className="supplement-formula">
    {details.amounts && <table className="supplement-amounts">
      <caption>Listed ingredient amounts</caption>
      <thead><tr><th scope="col">Ingredient</th><th scope="col">Amount</th></tr></thead>
      <tbody>{details.amounts.map(row => <tr key={row.ingredient}>
        <th scope="row">{row.ingredient}{row.detail && <small>{row.detail}</small>}</th>
        <td>{row.amount}</td>
      </tr>)}</tbody>
    </table>}
    {showFullIngredients && <><p className="supplement-subheading">Full ingredients</p><p>{details.ingredients}</p></>}
    {!!details.allergens?.length && <div className="supplement-allergens"><strong>Allergen information</strong>{details.allergens.map(note => <p key={note}>{note}</p>)}</div>}
    {!!details.dietary.length && <ul className="supplement-dietary" aria-label="Product attributes">{details.dietary.map(item => <li key={item}>{item}</li>)}</ul>}
  </div>;
}

export function SupplementDirections({details}: {details: SupplementDetails}) {
  return <div className="supplement-directions">
    {details.directions.map(text => <p key={text}>{text}</p>)}
    {details.notes?.map(text => <p key={text}>{text}</p>)}
  </div>;
}
