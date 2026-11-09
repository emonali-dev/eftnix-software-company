// EFTNIX Supabase client integration. Publishable key is intended for browser use; RLS is mandatory.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const SUPABASE_URL='https://ketzuhfolwhofrnliirf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_APFwXGPzKjDbIkfa-UbVgw_gL22Zczo';
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const toast=m=>{const t=$('#toast');if(t){t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',4000)}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null;
function authPanel(){
 if($('#eftnixAuth'))return;
 const el=document.createElement('section');el.id='eftnixAuth';el.className='card';el.style.cssText='max-width:560px;margin:24px auto;padding:22px';
 el.innerHTML='<h3>Customer / Admin sign in</h3><p class="hint">Sign in to submit payment proof or access your authorised account.</p><form id="eftnixAuthForm"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" required autocomplete="current-password"></div><div class="actions"><button class="btn" type="submit">Sign in</button><button class="btn secondary" id="eftnixSignup" type="button">Create account</button><button class="btn secondary" id="eftnixLogout" type="button">Sign out</button></div><p id="eftnixAuthStatus" class="hint" aria-live="polite"></p></form>';
 $('#payment').prepend(el);
 $('#eftnixAuthForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});$('#eftnixAuthStatus').textContent=error?error.message:'Signed in.';if(!error){await refreshSession();toast('Signed in successfully.')}});
 $('#eftnixSignup').addEventListener('click',async()=>{const f=new FormData($('#eftnixAuthForm'));const email=f.get('email'),password=f.get('password');if(!email||!password||password.length<8){$('#eftnixAuthStatus').textContent='Enter email and a password of at least 8 characters.';return}const {error}=await db.auth.signUp({email,password});$('#eftnixAuthStatus').textContent=error?error.message:'Account request sent. Check your email to confirm your account.'});
 $('#eftnixLogout').addEventListener('click',async()=>{await db.auth.signOut();await refreshSession();toast('Signed out.')});
}
async function refreshSession(){const {data}=await db.auth.getSession();session=data.session;const el=$('#eftnixAuthStatus');if(el)el.textContent=session?'Signed in as '+session.user.email:'Not signed in.';const btn=$('#eftnixAdminLogin');if(btn)btn.textContent=session?'Refresh admin desk':'Sign in to admin desk';}
authPanel();refreshSession();db.auth.onAuthStateChange((_event,s)=>{session=s});
const qform=$('#quoteForm');
if(qform)qform.addEventListener('submit',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 const f=new FormData(qform),features=$$('#features input:checked').map(x=>x.value);
 const record={name:f.get('name'),email:f.get('email'),phone:f.get('phone')||null,service:f.get('service'),complexity:$('#complexity').selectedOptions[0]?.text||null,currency:f.get('currency'),features,estimate:$('#estimate').textContent,timeline:f.get('timeline')||null,budget:f.get('budget')||null,details:f.get('details')||null,user_id:session?.user?.id||null};
 const btn=qform.querySelector('[type=submit]');btn.disabled=true;
 const {error}=await db.from('quotes').insert(record);btn.disabled=false;
 if(error){toast('Could not save quote: '+error.message);return}
 qform.reset();toast('Quotation request saved securely. EFTNIX will contact you by email.');
},true);
const pform=$('#paymentForm');
if(pform)pform.addEventListener('submit',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 if(!session){toast('Please sign in or create a customer account before submitting payment proof.');$('#eftnixAuth')?.scrollIntoView({behavior:'smooth'});return}
 const file=$('#proof').files[0];if(!file){toast('Choose a payment proof file.');return}
 if(file.size>5*1024*1024||!['image/jpeg','image/png','application/pdf'].includes(file.type)){toast('Upload JPG, PNG or PDF up to 5 MB.');return}
 const f=new FormData(pform),id=crypto.randomUUID(),path=session.user.id+'/'+id+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
 const btn=pform.querySelector('[type=submit]');btn.disabled=true;
 let up=await db.storage.from('payment-proofs').upload(path,file,{contentType:file.type,upsert:false});
 if(up.error){btn.disabled=false;toast('Secure upload failed: '+up.error.message);return}
 const {error}=await db.from('payment_submissions').insert({user_id:session.user.id,customer_name:f.get('customer'),email:f.get('email'),method:f.get('method'),amount_bdt:Number(f.get('amount')),reference:f.get('reference')||null,transaction_id:String(f.get('trx')).trim(),proof_path:path});
 btn.disabled=false;
 if(error){await db.storage.from('payment-proofs').remove([path]);toast('Payment record could not be saved: '+error.message);return}
 pform.reset();$('#filePreview').textContent='';toast('Payment submitted as PENDING. It is not approved until EFTNIX verifies it in the official account.');
},true);
const oldAdmin=$('#adminLogin');
if(oldAdmin){
 const btn=oldAdmin.cloneNode(true);oldAdmin.replaceWith(btn);btn.id='eftnixAdminLogin';btn.textContent='Sign in to admin desk';
 btn.addEventListener('click',async()=>{
  await refreshSession();if(!session){authPanel();$('#eftnixAuth')?.scrollIntoView({behavior:'smooth'});toast('Sign in with an authorised EFTNIX admin account.');return}
  const {data:isAdmin,error:roleError}=await db.rpc('is_eftnix_admin');
  if(roleError||!isAdmin){toast('This account is not authorised as an EFTNIX administrator.');return}
  const {data:pay,error:pe}=await db.from('payment_submissions').select('id,created_at,customer_name,email,method,amount_bdt,transaction_id,status,proof_path').order('created_at',{ascending:false}).limit(100);
  if(pe){toast('This account does not have admin permission.');return}
  const panel=$('#adminPanel');panel.classList.remove('hidden');
  const {data:quotes}=await db.from('quotes').select('id,created_at,name,email,service,status').order('created_at',{ascending:false}).limit(100);
  panel.querySelector('.notice')?.remove();
  const oldTable=panel.querySelector('.tablewrap');
  oldTable.innerHTML='<h3>Payment submissions</h3><table><thead><tr><th>Date</th><th>Customer</th><th>Method</th><th>Amount</th><th>Transaction</th><th>Status</th><th>Proof</th><th>Action</th></tr></thead><tbody>'+pay.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td>'+esc(x.customer_name)+'<br>'+esc(x.email)+'</td><td>'+esc(x.method)+'</td><td>৳'+esc(x.amount_bdt)+'</td><td>'+esc(x.transaction_id)+'</td><td>'+esc(x.status)+'</td><td><button class="btn secondary small" data-proof="'+esc(x.proof_path)+'">View</button></td><td><button class="btn small" data-review="'+x.id+'" data-status="approved">Approve</button> <button class="btn danger small" data-review="'+x.id+'" data-status="rejected">Reject</button></td></tr>').join('')+'</tbody></table><h3>Quotation requests</h3><table><thead><tr><th>Date</th><th>Customer</th><th>Service</th><th>Status</th></tr></thead><tbody>'+((quotes||[]).map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td>'+esc(x.name)+'<br>'+esc(x.email)+'</td><td>'+esc(x.service)+'</td><td>'+esc(x.status)+'</td></tr>').join('')||'<tr><td colspan="4">No quote requests.</td></tr>')+'</tbody></table>';
  panel.querySelectorAll('[data-proof]').forEach(b=>b.addEventListener('click',async()=>{const {data,error}=await db.storage.from('payment-proofs').createSignedUrl(b.dataset.proof,60);if(error){toast(error.message);return}window.open(data.signedUrl,'_blank','noopener')}));
  panel.querySelectorAll('[data-review]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Change payment status to '+b.dataset.status+'? Verify transaction first in official bKash/Nagad account.'))return;const {error}=await db.from('payment_submissions').update({status:b.dataset.status,reviewed_at:new Date().toISOString(),reviewed_by:session.user.id}).eq('id',b.dataset.review);if(error){toast(error.message);return}toast('Payment status updated.');btn.click()}));
  $('#statTotal').textContent=pay.length;$('#statPending').textContent=pay.filter(x=>x.status==='pending').length;$('#statApproved').textContent=pay.filter(x=>x.status==='approved').length;$('#statRejected').textContent=pay.filter(x=>x.status==='rejected').length;
  panel.scrollIntoView({behavior:'smooth'});
 });
}
const note=$('#paymentForm .hint');if(note)note.textContent='Secure upload. Sign in required. Every submission remains pending until manually verified.';
const adminNote=$('#admin .hint');if(adminNote)adminNote.textContent='Restricted EFTNIX admin desk · Supabase Auth + Row Level Security';
