import {createHmac,timingSafeEqual} from 'node:crypto';

export function commerce(env,origin){
 const secret=env.STRIPE_SECRET_KEY;
 const signing=env.STRIPE_WEBHOOK_SECRET;
 const currency=(env.STRIPE_CURRENCY||'usd').toLowerCase();
 const enabled=!!(secret&&signing&&origin?.startsWith('https:')&&/^[a-z]{3}$/.test(currency));
 const usd=!env.STRIPE_CURRENCY||currency==='usd';
 const amounts=[Number(env.PREMIUM_AMOUNT|| (usd?399:0)),Number(env.PASS_AMOUNT|| (usd?599:0))];
 const products=[
  {id:'premium',title:'Golden Glitch skin',amount:amounts[0],currency},
  {id:'pass',title:'Season cosmetic pass',amount:amounts[1],currency}
 ].filter(p=>enabled&&Number.isInteger(p.amount)&&p.amount>=50&&p.amount<100000);
 async function checkout(user,sku,season){
  const p=products.find(product=>product.id===sku);
  if(!p)throw Object.assign(Error('This cosmetic offer is unavailable.'),{status:404});
  if(sku==='pass'&&Date.now()+35*60000>=Date.parse(season+'-01T00:00:00Z')+daysInMonth(season)*86400000)throw Object.assign(Error('The next season is about to begin.'),{status:409});
  const fields=new URLSearchParams({
   mode:'payment',success_url:origin+'/?checkout=done',cancel_url:origin+'/?checkout=cancel',
   client_reference_id:user.id,'metadata[sku]':sku,'metadata[season]':season,'metadata[amount]':String(p.amount),'metadata[currency]':p.currency,
   expires_at:String(Math.floor(Date.now()/1000)+32*60),'payment_method_types[0]':'card',
   'line_items[0][quantity]':'1','line_items[0][price_data][currency]':p.currency,
   'line_items[0][price_data][unit_amount]':String(p.amount),'line_items[0][price_data][product_data][name]':p.title
  });
  const res=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+secret},body:fields,signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Object.assign(Error('Checkout is temporarily unavailable.'),{status:502});
  const {url}=await res.json();
  if(!url||new URL(url).hostname!=='checkout.stripe.com')throw Error('Invalid checkout response');
  return url;
 }
 function verify(raw,header){
  if(!enabled||!header)return null;
  const fields=header.split(',').map(field=>field.split('='));
  const timestamp=fields.find(([k])=>k==='t')?.[1];
  if(!/^\d+$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300)return null;
  const expected=createHmac('sha256',signing).update(timestamp+'.').update(raw).digest();
  if(!fields.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v||'')&&timingSafeEqual(expected,Buffer.from(v,'hex'))))return null;
  try{return JSON.parse(raw);}catch{return null;}
 }
 return {products,checkout,verify};
}
function daysInMonth(season){
 const [year,month]=season.split('-').map(Number);return new Date(Date.UTC(year,month,0)).getUTCDate();
}
