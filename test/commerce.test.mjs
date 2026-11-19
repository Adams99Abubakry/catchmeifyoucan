import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {commerce} from '../commerce.mjs';

test('cosmetic checkout stays disabled without HTTPS and validates webhook signatures',()=>{
 const env={STRIPE_SECRET_KEY:'test-only',STRIPE_WEBHOOK_SECRET:'test-signing-key'};
 assert.deepEqual(commerce({},'https://arena.example').products,[]);
 assert.deepEqual(commerce(env,'http://arena.example').products,[]);
 const shop=commerce(env,'https://arena.example');
 assert.deepEqual(shop.products.map(p=>p.id),['premium','pass']);
 const event={type:'checkout.session.completed',data:{object:{payment_status:'paid'}}};
 const raw=Buffer.from(JSON.stringify(event));
 const signature=t=>'t='+t+',v1='+createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(t+'.').update(raw).digest('hex');
 const t=Math.floor(Date.now()/1000);
 assert.deepEqual(shop.verify(raw,signature(t)),event);
 assert.equal(shop.verify(Buffer.from('{}'),signature(t)),null);
 assert.equal(shop.verify(raw,signature(t-360)),null);
});
