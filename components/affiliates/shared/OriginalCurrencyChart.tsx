import type {ReactNode} from 'react';
import {originalCurrency,type OriginalMoney} from './original-view';
/** Do not present a zero chart when the original single-axis chart cannot represent separate currencies. */
export function OriginalCurrencyChart({rows,children}:{rows:OriginalMoney[];children:ReactNode}){
 if(rows.length && !originalCurrency(rows))return <p className="text-sm text-[#64717a] py-8" role="status">This chart cannot combine different or unknown currencies. Your records are unchanged; separate currency amounts remain in the totals and tables.</p>;
 return <>{children}</>;
}
