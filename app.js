const SUPABASE_URL="https://oebapdfkaumpmwdblqbv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_wmNek6qB6MCiPIJzueJhVQ_7-6d42yl";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const incomingReferral=new URLSearchParams(location.search).get("ref");if(incomingReferral&&/^[A-Z0-9]{6,12}$/i.test(incomingReferral)){try{localStorage.setItem("retail_referral_code",incomingReferral.toUpperCase())}catch(e){}}
const $=id=>document.getElementById(id), money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
let products=[],categories=[],allCategories=[],cart=JSON.parse(localStorage.getItem("retail_cart")||"[]"),active="All",user=null,profile=null,productAlertChannel=null;
const sample=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function modal(h){$("modalBody").innerHTML=h;/* The modal is wrapped in a method=dialog form. Prevent dashboard/action buttons from accidentally submitting and closing it. */$("modalBody").querySelectorAll("button:not(.close)").forEach(b=>{if(!b.hasAttribute("type"))b.type="button"});$("modal").showModal()}
function closeModal(){if($("modal").open)$("modal").close()}
function syncAccountButtons(){ $("loginBtn").hidden=!!user; $("accountBtn").hidden=!user; const a=$("adminNavBtn"); if(a)a.hidden=!(user&&profile?.role==="admin"); }
function off(p){let m=Number(p.mrp||p.price||0),s=Number(p.sale_price||p.price||0);return m>s?Math.round((m-s)*100/m):0}
function saveCart(){localStorage.setItem("retail_cart",JSON.stringify(cart));$("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0)}
function price(p){return Number(p.sale_price??p.price??0)}
function renderCats(){let list=["All",...categories.map(c=>c.name).filter(Boolean)];$("cats").innerHTML=list.map(c=>`<button class="${active===c?"selected":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
function retailNormalize(s){return String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(" ").filter(Boolean).join(" ")}
function retailEditDistance(a,b){if(Math.abs(a.length-b.length)>3)return 99;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function retailMatches(text,query){const q=retailNormalize(query);if(!q)return true;const hay=retailNormalize(text);if(hay.includes(q))return true;const qs=q.split(" "),hs=hay.split(" ");return qs.every(token=>hs.some(word=>word.startsWith(token)||retailEditDistance(token,word)<=Math.max(1,Math.floor(token.length/3))))}
function render(){
 const q=$("search").value.trim().toLowerCase();
 const shown=products.filter(p=>(active==="All"||p.category===active)&&(!q||retailMatches([p.title,p.brand,p.category,p.description].join(" "),q)));
 $("resultCount").textContent=shown.length+" items";
 $("products").innerHTML=shown.map(p=>{const o=off(p);return `<article class="product" data-product="${p.id}"><div class="photo">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:(p.emoji||"📦")}</div><div class="pbody"><div class="tag">${esc(p.category||"Other")}</div><h3>${esc(p.title)}</h3><div class="prices"><b>${money(price(p))}</b> ${o?`<span class="off">${o}% OFF</span>`:""}</div><div class="seller">Sold by ${esc(p.seller_name||"Marketplace seller")} · Stock ${Number(p.stock??0)}</div><div class="actions"><button class="add" data-add="${p.id}">Add to cart</button><button class="buy" data-buy="${p.id}">Buy Now</button></div></div></article>`}).join("")||"<div class='empty'>No products found.</div>";
 document.querySelectorAll("[data-product]").forEach(x=>x.onclick=e=>{if(!e.target.closest("button"))showProduct(x.dataset.product)});
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=e=>{e.stopPropagation();addToCart(b.dataset.add)});
 document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async e=>{e.stopPropagation();let p=getP(b.dataset.buy);if(p)await checkout([{id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty:1}])});
 saveCart();
}
function getP(id){return products.find(p=>String(p.id)===String(id))}
function addToCart(id,qty=1){let p=getP(id);if(!p||String(id).startsWith("sample")){modal("<h2>Demo product</h2><p>Login and use the live catalogue to place a real COD order.</p>");return}let x=cart.find(i=>i.id===id);if(x)x.qty=Math.min(x.qty+qty,Number(p.stock||99));else cart.push({id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty});saveCart();toast("Added to cart ✓")}
function toast(t){let x=document.createElement("div");x.className="toast";x.textContent=t;document.body.appendChild(x);setTimeout(()=>x.remove(),1800)}
async function load(){
 const list=$("products"), count=$("resultCount");
 /* Render a safe fallback immediately so a slow database never leaves the screen spinning. */
 if(!products.length){products=[];renderCats();render();}
 if(count)count.textContent="Connecting to live catalogue…";
 try{
  const requests=Promise.all([
   db.from("categories").select("id,name,slug").order("name"),
   db.from("products").select("id,title,description,price,mrp,sale_price,brand,stock,image_url,status,seller_id,category_id").eq("status","active").order("created_at",{ascending:false}).limit(100)
  ]);
  const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error("The catalogue database did not respond in time.")),12000));
  const [c,p]=await Promise.race([requests,timeout]);
  if(c.error)console.warn("RETAIL categories:",c.error.message); else {allCategories=c.data||[];categories=allCategories;}
  if(p.error){
   console.error("RETAIL products:",p.error);
   products=[];
   if(count)count.textContent="Catalogue connection issue";
   if(list)list.innerHTML="<div class='empty'>Live catalogue could not load. Check the Supabase database settings and product-table permissions. No sample products are shown.</div>";
  }else{
   products=(p.data||[]).map(x=>({...x,category:categories.find(k=>k.id===x.category_id)?.name||"Other",seller_name:"Marketplace seller"}));
   if(!products.length && list)list.innerHTML="<div class='empty'>No products available yet. Please check back soon.</div>";
  }
  renderCats();render();
  const initialProduct=location.hash.match(/^#product\/(.+)$/); if(initialProduct)showProduct(decodeURIComponent(initialProduct[1]));
  if(p.error && count)count.textContent="Database error";
 }catch(e){
  console.error("RETAIL catalogue load failed:",e);
  products=[];
  renderCats();render();
  if(count)count.textContent="Could not connect";
  if(list)list.insertAdjacentHTML("afterbegin","<div class='empty'>Could not connect to the live catalogue. Please check the database configuration.</div>");
 }
}
async function refreshUser(explicitUser=null){try{let r=explicitUser?{data:{user:explicitUser}}:await db.auth.getUser();user=r?.data?.user||null;if(user){let p=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=p.data||null;if(!profile){let meta=user.user_metadata||{};let created=await db.from("profiles").upsert({id:user.id,full_name:meta.full_name||user.email?.split("@")[0]||"RETAIL customer",phone:meta.phone||null,role:"customer"},{onConflict:"id"});if(!created.error){let again=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=again.data||null}}syncAccountButtons();return user}else{profile=null;syncAccountButtons();return null}}catch(e){console.error("RETAIL refreshUser failed:",e);syncAccountButtons();throw e}}
async function auth(){
 try{
  if(!window.supabase||!db){alert("RETAIL login service could not load. Refresh the page and try again.");return;}
  modal(`<h2>RETAIL account</h2><p class="notice">Login is required to place and track orders.</p><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com"><label>Password</label><input id="password" type="password" autocomplete="current-password" minlength="6" placeholder="Minimum 6 characters"><label>Name (for new account)</label><input id="fullName" autocomplete="name" placeholder="Your name"><label>Mobile</label><input id="phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile"><button class="primary wide" id="authGo" type="button">Login / Create account</button><div class="twocol"><button class="dash" id="forgotPass" type="button">Forgot password?</button><button class="dash" id="resendVerify" type="button">Resend verification</button></div><p id="authMsg" role="status" aria-live="polite"></p>`);
  const go=$("authGo");
  if(!go)throw new Error("Login form did not open correctly.");
  $("forgotPass").onclick=async()=>{
   const email=$("email").value.trim(),m=$("authMsg");
   if(!email){m.textContent="Enter your account email first.";return;}
   m.textContent="Sending password reset link…";
   const r=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   m.textContent=r.error?r.error.message:"If this email has a RETAIL account, a password reset link has been sent. Check inbox and spam.";
  };
  $("resendVerify").onclick=async()=>{
   const email=$("email").value.trim(),m=$("authMsg");
   if(!email){m.textContent="Enter your account email first.";return;}
   m.textContent="Sending verification email…";
   const r=await db.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname}});
   m.textContent=r.error?r.error.message:"If this account needs verification, a new confirmation email has been sent. Check inbox and spam.";
  };
  go.onclick=async()=>{
   const email=$("email").value.trim(),password=$("password").value,n=$("fullName").value.trim(),ph=$("phone").value.trim(),m=$("authMsg");
   if(!email||password.length<6){m.textContent="Enter a valid email and a password of at least 6 characters.";return;}
   go.disabled=true;go.textContent="Please wait…";m.textContent="Connecting securely…";
   try{
    let r=await db.auth.signInWithPassword({email,password});
    if(!r.error){
     await refreshUser(r.data.user);
     if(!user){m.textContent="Login returned without an active session. Please refresh and try again.";return;}
     closeModal();syncAccountButtons();toast("Logged in ✓");await account();return;
    }
    const loginError=r.error;
    if(!/invalid login credentials|email not confirmed|user not found/i.test(loginError.message||"")){
     m.textContent=loginError.message||"Login failed. Please try again.";return;
    }
    if(/email not confirmed/i.test(loginError.message||"")){
     m.textContent="Please verify your email from the confirmation message, then log in again.";return;
    }
    r=await db.auth.signUp({email,password,options:{data:{full_name:n,phone:ph,referral_code:(localStorage.getItem("retail_referral_code")||"")}}});
    if(r.error){m.textContent=(/already registered|already exists/i.test(r.error.message||""))?"This email already has an account. Check your password or use Forgot Password in Supabase.":r.error.message;return;}
    if(r.data?.session){
     await db.from("profiles").upsert({id:r.data.user.id,full_name:n||email.split("@")[0],phone:ph||null,role:"customer"});
     await refreshUser();closeModal();toast("Account created & logged in ✓");account();return;
    }
    m.textContent="Account created. Check your email for a verification link, verify it, then return here and log in.";
   }catch(err){console.error("RETAIL auth action failed:",err);m.textContent=err?.message||"Could not connect. Check your internet and try again.";}
   finally{go.disabled=false;go.textContent="Login / Create account";}
  };
 }catch(err){console.error("RETAIL auth form failed:",err);alert("Could not open RETAIL login. Please refresh the page and try again.");}
}
async async function account(){
 if(!user){auth();return}
 const isAdmin=profile?.role==="admin";
 if(isAdmin){
  modal(`<h2>Admin Profile</h2><p><b>${esc(profile?.full_name||user.email)}</b><br>${esc(user.email||"")}</p><p class="notice">Admin-only workspace. Customer and seller menus are kept separate.</p><div class="dashgrid"><button class="dash" id="admProfileOrders">All Orders</button><button class="dash" id="admProfileProducts">All Products</button><button class="dash" id="admProfileSellers">Seller Management</button><button class="dash" id="admProfilePanel">Admin Dashboard</button><button class="dash danger" id="admProfileLogout">Logout</button></div><div id="adminBody"></div>`);
  $("admProfileOrders").onclick=()=>adminOrders();$("admProfileProducts").onclick=()=>adminProducts();$("admProfileSellers").onclick=()=>adminSellers();$("admProfilePanel").onclick=()=>adminPanel();
  $("admProfileLogout").onclick=async()=>{await db.auth.signOut();profile=null;user=null;syncAccountButtons();closeModal();await refreshUser();toast("Logged out")};
  return;
 }
 const sr=await db.from("seller_profiles").select("store_name,status,commission_percent").eq("user_id",user.id).maybeSingle();
 const seller=sr.data,approved=seller?.status==="approved";
 if(seller){
  modal(`<h2>Seller Profile</h2><p><b>${esc(seller.store_name||"My Store")}</b></p><p>${esc(user.email||"")}<br>${esc(profile?.phone||"")}</p><div class="notice">Seller status: <b>${esc(seller.status)}</b> · Commission: ${Number(seller.commission_percent??10)}%</div><div class="dashgrid">${approved?'<button class="dash" id="sellerProfileOrders">My Store Orders</button><button class="dash" id="sellerProfileProducts">My Products</button><button class="dash" id="sellerProfileAdd">Add Product</button>':'<button class="dash" id="sellerProfileStatus">Application Status</button>'}<button class="dash" id="sellerProfileEdit">Store Dashboard</button><button class="dash danger" id="sellerProfileLogout">Logout</button></div><div id="sellerBody"></div>`);
  if(approved){$("sellerProfileOrders").onclick=sellerOrders;$("sellerProfileProducts").onclick=sellerProducts;$("sellerProfileAdd").onclick=()=>productForm()}
  else $("sellerProfileStatus").onclick=()=>toast("Seller application: "+seller.status);
  $("sellerProfileEdit").onclick=()=>sellerPanel();
  $("sellerProfileLogout").onclick=async()=>{await db.auth.signOut();profile=null;user=null;syncAccountButtons();closeModal();await refreshUser();toast("Logged out")};
  return;
 }
 modal(`<h2>My Customer Profile</h2><p><b>${esc(profile?.full_name||user.email)}</b><br>${esc(user.email||"")}<br>${esc(profile?.phone||"")}</p><div class="dashgrid"><button class="dash" id="ordersBtn">My Purchases & Orders</button><button class="dash" id="sellerBtn">Become a Seller</button><button class="dash" id="coinsBtn">🪙 My Coins & Invite</button><button class="dash" id="alertsBtn">🔔 Product Alerts</button><button class="dash danger" id="logoutBtn">Logout</button></div><div id="dashBody"></div>`);
 $("ordersBtn").onclick=myOrders;$("sellerBtn").onclick=sellerPanel;$("coinsBtn").onclick=rewardsPanel;$("alertsBtn").onclick=enableProductAlerts;
 $("logoutBtn").onclick=async()=>{await db.auth.signOut();profile=null;user=null;syncAccountButtons();closeModal();await refreshUser();toast("Logged out")};
}
async function rewardsPanel(){
 if(!user){auth();return}
 const body=$("dashBody");
 body.innerHTML="<p>Loading your coins…</p>";
 const result=await db.from("profiles").select("referral_code,coins_balance").eq("id",user.id).maybeSingle();
 if(result.error||!result.data){body.innerHTML="<p class='notice'>Could not load coins: "+esc(result.error?.message||"Profile unavailable")+"</p>";return}
 profile={...(profile||{}),...result.data};
 const code=result.data.referral_code||"";
 const link=location.origin+location.pathname+"?ref="+encodeURIComponent(code);
 const ledger=await db.from("coin_transactions").select("amount,reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(10);
 body.innerHTML=`<section class="notice"><h3>🪙 RETAIL Coins</h3><p style="font-size:28px;font-weight:800;margin:6px 0">${Number(result.data.coins_balance||0)} coins</p><p>Earn 10 coins when a new user successfully registers through your invite link. Listing one product costs 50 coins.</p></section><label>Your referral link</label><input id="referralLink" readonly value="${esc(link)}"><button class="primary wide" id="copyReferral" type="button">Copy Invite Link</button><button class="dash wide" id="shareReferral" type="button">Share Link</button><h3>Recent coin activity</h3>${(ledger.data||[]).map(x=>`<div class="adminrow"><span>${x.reason==="referral_signup"?"Successful referral":x.reason==="product_listing"?"Product listing":"Coin adjustment"}<br><small>${new Date(x.created_at).toLocaleString("en-IN")}</small></span><b>${x.amount>0?"+":""}${x.amount} coins</b></div>`).join("")||"<p>No coin activity yet.</p>"}`;
 $("copyReferral").onclick=async()=>{try{await navigator.clipboard.writeText(link);toast("Invite link copied ✓")}catch(e){$("referralLink").focus();$("referralLink").select();toast("Select and copy your invite link")}};
 $("shareReferral").onclick=async()=>{if(navigator.share){try{await navigator.share({title:"Join RETAIL Marketplace",text:"Join RETAIL using my invite link:",url:link})}catch(e){}}else{try{await navigator.clipboard.writeText(link);toast("Invite link copied ✓")}catch(e){$("referralLink").focus();$("referralLink").select()}}};
}
async function enableProductAlerts(){
 if(!("Notification" in window)){modal("<h2>Product alerts</h2><p>This browser does not support free browser notifications. You can still see new products while browsing RETAIL.</p>");return}
 let permission=Notification.permission;
 if(permission!=="granted"){permission=await Notification.requestPermission()}
 if(permission!=="granted"){modal("<h2>Notifications not enabled</h2><p>To receive free product alerts, allow notifications for RETAIL in your browser settings.</p>");return}
 try{localStorage.setItem("retail_product_alerts","1")}catch(e){}
 startProductAlerts();
 modal("<h2>🔔 Product alerts enabled</h2><p>Free alerts are enabled on this device. When RETAIL is open and connected, you can get a notification when a new product is listed.</p><p class=notice>No SMS charges. Alerts may not arrive when the site is closed because background push is not configured.</p>");
}
function startProductAlerts(){
 if(productAlertChannel||!("Notification" in window)||Notification.permission!=="granted")return;
 try{if(localStorage.getItem("retail_product_alerts")!=="1")return}catch(e){return}
 productAlertChannel=db.channel("retail-live-product-alerts").on("postgres_changes",{event:"INSERT",schema:"public",table:"products"},payload=>{
  const p=payload.new||{};
  if(!p.id||p.status!=="active"||String(p.seller_id||"")===String(user?.id||""))return;
  const title=String(p.title||"New product").slice(0,100);
  try{const n=new Notification("New on RETAIL: "+title,{body:"Tap to see product details.",icon:"retail-logo.svg"});n.onclick=()=>{window.focus();window.location.href=location.origin+location.pathname+"#product/"+encodeURIComponent(p.id)}}catch(e){console.warn("RETAIL notification could not display:",e)}
  toast("New product listed: "+title);
  load().catch(e=>console.warn("Could not refresh after new product:",e));
 }).subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("RETAIL live product alerts connection:",status)});
}
async function myOrders(){
 if(!user){auth();return}
 const body=$("dashBody");
 body.innerHTML="<h3>My Orders</h3><p>Loading your orders…</p>";
 const r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,platform_commission,delivery_address,created_at,order_items(product_title,unit_price,quantity,seller_amount,commission_amount)").eq("customer_id",user.id).order("created_at",{ascending:false});
 if(r.error){body.innerHTML="<h3>My Orders</h3><p class='notice'>Orders could not be loaded: "+esc(r.error.message)+"</p><button class='dash' id='ordersRetry' type='button'>Try again</button>";$("ordersRetry").onclick=myOrders;return}
 const statusInfo={placed:["Pending","Your order has been placed."],pending:["Pending","Your order is waiting for confirmation."],confirmed:["Confirmed","Your order is confirmed."],packed:["Packed","Your order is being prepared."],shipped:["Shipped","Your order is on the way."],delivered:["Delivered","Your order has been delivered."],cancelled:["Cancelled","This order has been cancelled."]};
 const orders=r.data||[];
 body.innerHTML="<h3>My Orders</h3>"+(orders.map(o=>{
  const s=String(o.status||"placed").toLowerCase(),info=statusInfo[s]||[s.charAt(0).toUpperCase()+s.slice(1),"Order status updated."];
  const tone=s==="delivered"?"#16803c":s==="cancelled"?"#c62828":s==="shipped"?"#0757c9":"#8a5a00";
  return `<div class="order"><b>${esc(o.order_number)}</b><span class="status" style="display:inline-block;margin-left:8px;padding:4px 9px;border-radius:999px;background:${tone}18;color:${tone};font-weight:700">${s==="delivered"?"✓ ":s==="cancelled"?"✕ ":""}${esc(info[0])}</span><div>${new Date(o.created_at).toLocaleString("en-IN")} · COD · ${money(o.subtotal)}</div><small>${(o.order_items||[]).map(i=>esc(i.product_title)+" × "+i.quantity).join(", ")}</small><p style="margin:7px 0 0;color:#555;font-size:13px">${esc(info[1])}</p></div>`;
 }).join("")||"<p>No orders yet.</p>")+"<button class='dash wide' id='refreshOrders' type='button'>Refresh order status</button>";
 $("refreshOrders").onclick=myOrders;
}
async function checkout(items=cart){
 if(!user){auth();return}
 if(!items.length){modal("<h2>Cart is empty</h2><p>Add products first.</p>");return}
 const ids=[...new Set(items.map(i=>i.id).filter(Boolean).map(String))];
 if(!ids.length){modal("<h2>Checkout unavailable</h2><p>Please remove old cart items and add products from the live catalogue.</p>");return}
 const liveResult=await db.from("products").select("id,title,price,sale_price,stock,image_url,status,seller_id").in("id",ids);
 if(liveResult.error){modal("<h2>Could not verify products</h2><p>"+esc(liveResult.error.message)+"</p><p>Please try again in a moment.</p>");return}
 const liveById=new Map((liveResult.data||[]).map(p=>[String(p.id),p]));
 const normalized=[];
 for(const item of items){
  const p=liveById.get(String(item.id));
  if(!p||p.status!=="active"){modal("<h2>Product unavailable</h2><p>"+esc(item.title||"A cart item")+" is no longer available. Please refresh the catalogue and update your cart.</p>");return}
  const qty=Math.max(1,Math.floor(Number(item.qty)||1)),stock=Number(p.stock??0);
  if(stock<qty){modal("<h2>Stock changed</h2><p>"+esc(p.title)+" has only "+stock+" item(s) in stock. Please update your cart.</p>");return}
  normalized.push({id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty});
 }
 items=normalized;
 const total=items.reduce((sum,i)=>sum+Number(i.price)*i.qty,0);
 modal(`<h2>COD Checkout</h2><div class="notice"><b>Cash on Delivery only.</b><br>No UPI or online payment is collected.</div><div class="summary">${items.map(i=>`<div class="lineitem"><span>${esc(i.title)} × ${i.qty}</span><b>${money(i.price*i.qty)}</b></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(total)}</b></div></div><label>Full name</label><input id="coName" value="${esc(profile?.full_name||"")}"><label>Mobile</label><input id="coPhone" value="${esc(profile?.phone||"")}" inputmode="tel"><label>Delivery address</label><textarea id="coAddress" rows="4" placeholder="House, village/city, district, PIN"></textarea><button class="primary wide" id="placeOrder" type="button">Place COD Order</button><p id="coMsg" role="status" aria-live="polite"></p>`);
 $("placeOrder").onclick=async()=>{
  let n=$("coName").value.trim(),ph=$("coPhone").value.trim(),addr=$("coAddress").value.trim(),m=$("coMsg");
  if(!n||!/^[0-9]{10}$/.test(ph)||!addr){m.textContent="Enter name, valid 10-digit mobile and full address.";return}
  const btn=$("placeOrder");btn.disabled=true;m.textContent="Checking latest price and stock…";
  try{
   const latest=await db.from("products").select("id,title,price,sale_price,stock,status,seller_id").in("id",ids);
   if(latest.error)throw new Error(latest.error.message);
   const latestById=new Map((latest.data||[]).map(p=>[String(p.id),p]));
   for(const item of items){
    const p=latestById.get(String(item.id));
    if(!p||p.status!=="active"||Number(p.stock??0)<item.qty){m.textContent="A product is no longer available or stock has changed. Close checkout, update your cart, and try again.";btn.disabled=false;return}
    if(price(p)!==Number(item.price)){m.textContent="The price of "+p.title+" has changed. Close checkout and reopen it to confirm the new total.";btn.disabled=false;return}
    if(!p.seller_id){m.textContent="Order unavailable: seller details are missing for "+p.title+".";btn.disabled=false;return}
   }
   m.textContent="Placing order…";
   const number="RET"+Date.now().toString().slice(-10);
   const o=await db.from("orders").insert({customer_id:user.id,order_number:number,status:"placed",payment_method:"cod",payment_status:"pending",subtotal:total,platform_commission:total*.10,delivery_address:{name:n,phone:ph,address:addr}}).select("id,order_number").single();
   if(o.error)throw new Error(o.error.message);
   const rows=items.map(i=>({order_id:o.data.id,product_id:i.id,seller_id:i.seller_id,product_title:i.title,unit_price:i.price,quantity:i.qty,seller_amount:i.price*i.qty*.90,commission_amount:i.price*i.qty*.10}));
   const ir=await db.from("order_items").insert(rows);
   if(ir.error){await db.from("orders").delete().eq("id",o.data.id);throw new Error(ir.error.message)}
   if(items.every(i=>cart.some(c=>String(c.id)===String(i.id)))){cart=[];saveCart()}
   closeModal();notifyWhatsApp(o.data.order_number,items,total,n,ph,addr);
  }catch(err){m.textContent=err?.message||"Could not place order. Please try again.";btn.disabled=false}
 };
}
function notifyWhatsApp(orderNumber,items,total,name,phone,address){
 const text="RETAIL ORDER "+orderNumber+"\n"+items.map(i=>i.title+" x "+i.qty+" = ₹"+(i.price*i.qty)).join("\n")+"\nTotal: ₹"+total+"\nPayment: Cash on Delivery\nCustomer: "+name+"\nMobile: "+phone+"\nAddress: "+address;
 modal('<h2>Order placed ✓</h2><p>Your COD order <b>'+esc(orderNumber)+'</b> has been saved.</p><p class="notice">Tap below to send the order details to RETAIL WhatsApp. WhatsApp will ask you to press Send.</p><a class="primary wide waLink" target="_blank" rel="noopener" href="https://wa.me/919045400392?text='+encodeURIComponent(text)+'">Send order to WhatsApp</a><button class="dash wide" id="doneOrder" type="button">Done</button>');
 $("doneOrder").onclick=closeModal;
}
function cartModal(){if(!cart.length){modal("<h2>Your cart is empty</h2><p>Choose a live product to add it here.</p>");return}let h=`<h2>Your Cart</h2>${cart.map((i,idx)=>`<div class="cartrow"><div><b>${esc(i.title)}</b><br><small>${money(i.price)} each</small></div><div class="qty"><button data-q="${idx}" data-d="-1">−</button><b>${i.qty}</b><button data-q="${idx}" data-d="1">+</button><button class="remove" data-r="${idx}">×</button></div></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(cart.reduce((s,i)=>s+i.price*i.qty,0))}</b></div><button class="primary wide" id="checkoutBtn" type="button">Checkout — COD</button>`;modal(h);document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{let i=cart[+b.dataset.q];i.qty=Math.max(1,i.qty+ +b.dataset.d);saveCart();cartModal()});document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.r,1);saveCart();cartModal()});$("checkoutBtn").onclick=()=>checkout(cart)}
function showProduct(id,buy=false){
 const p=getP(id); if(!p)return;
 const related=products.filter(x=>String(x.id)!==String(p.id)&&x.category===p.category).slice(0,4);
 const page=$("productPage");
 if(!page){modal("<h2>Product details unavailable</h2><p>Please refresh Retail.</p>");return;}
 const heroSection=$("heroSection"); if(heroSection)heroSection.hidden=true; const catalogHeading=$("catalogHeading"); if(catalogHeading)catalogHeading.hidden=true; const productsGrid=$("products"); if(productsGrid)productsGrid.hidden=true; page.hidden=false;
 history.pushState({retailProduct:String(id)},"","#product/"+encodeURIComponent(id));
 page.innerHTML=`<button class="back-products" id="backProducts">← Back to products</button>
 <div class="product-detail-page">
 <div class="detail-image-wrap">${p.image_url?`<img class="detail-main-image" src="${esc(p.image_url)}" alt="${esc(p.title)}">`:`<div class="detail-main-image detailemoji">${esc(p.emoji||"📦")}</div>`}</div>
 <div class="detail-info"><span class="tag">${esc(p.category||"Other")}</span><h1>${esc(p.title)}</h1>
 <p class="detail-description">${esc(p.description||"Quality product from RETAIL.")}</p>
 <div class="detail-price">${money(price(p))} ${off(p)?`<span class="off">${off(p)}% OFF</span>`:""}</div>
 <p class="detail-meta"><b>Brand:</b> ${esc(p.brand||"—")}</p><p class="detail-meta"><b>Availability:</b> ${Number(p.stock||0)>0?"In stock":"Check availability"}</p>
 <div class="detail-actions"><button class="add" id="detailAdd">Add to Cart</button><button class="buy" id="detailBuy">Buy Now</button></div>
 <p class="notice">Payment: Cash on Delivery</p></div></div>
 <section class="similar-section"><h2>Similar products</h2><div class="products similar-products">${related.map(x=>`<article class="product" data-related-product="${x.id}"><div class="photo">${x.image_url?`<img src="${esc(x.image_url)}" alt="${esc(x.title)}">`:esc(x.emoji||"📦")}</div><div class="pbody"><h3>${esc(x.title)}</h3><div class="prices"><b>${money(price(x))}</b></div><button class="buy wide" data-related-open="${x.id}">View details</button></div></article>`).join("")||"<p>No similar products yet.</p>"}</div></section>`;
 $("backProducts").onclick=()=>showCatalogue(true);
 $("detailAdd").onclick=()=>addToCart(p.id);
 $("detailBuy").onclick=()=>checkout([{id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty:1}]);
 page.querySelectorAll("[data-related-open]").forEach(b=>b.onclick=()=>showProduct(b.dataset.relatedOpen));
 page.querySelectorAll("[data-related-product]").forEach(card=>card.onclick=e=>{if(!e.target.closest("button"))showProduct(card.dataset.relatedProduct)});
 if(buy) $("detailBuy").click();
}
function showCatalogue(clearHash=false){
 const page=$("productPage");if(page)page.hidden=true;
 const heroSection=$("heroSection");if(heroSection)heroSection.hidden=false;$("catalogHeading").hidden=false;$("products").hidden=false;
 if(clearHash&&location.hash.startsWith("#product/"))history.pushState({retailHome:true},"",location.pathname+location.search);
 window.scrollTo({top:0,behavior:"smooth"});
}
window.addEventListener("popstate",()=>{
 const match=location.hash.match(/^#product\/(.+)$/);
 if(match){showProduct(decodeURIComponent(match[1]));}
 else showCatalogue(false);
});
async function sellerPanel(){
 if(!user){auth();return}
 let r=await db.from("seller_profiles").select("*").eq("user_id",user.id).maybeSingle(),sp=r.data;
 if(!sp){modal(`<h2>Become a seller</h2><p>Apply once. After admin approval you can list products.</p><label>Store name</label><input id="storeName" placeholder="Your store"><button class="primary wide" id="applySeller">Submit application</button><p id="sellerMsg"></p>`);$("applySeller").onclick=async()=>{let s=$("storeName").value.trim(),m=$("sellerMsg");if(!s){m.textContent="Enter store name.";return}let x=await db.from("seller_profiles").insert({user_id:user.id,store_name:s,status:"pending",commission_percent:10});m.textContent=x.error?x.error.message:"Application submitted. Wait for admin approval.";};return}
 let approved=sp.status==="approved";modal(`<h2>Seller Dashboard</h2><p>Store: <b>${esc(sp.store_name)}</b> · Status: <b>${esc(sp.status)}</b> · Commission: 10%</p>${approved?`<button class="primary wide" id="addProduct">Add Product</button><button class="dash wide" id="myProducts">My Products</button><button class="dash wide" id="sellerOrders">Seller Orders</button><div id="sellerBody"></div>`:"<p class='notice'>Admin approval is required before you can add products.</p>"}`);if(approved){$("addProduct").onclick=()=>productForm();$("myProducts").onclick=()=>sellerProducts();$("sellerOrders").onclick=()=>sellerOrders()}}
async function sellerProducts(){
 let r=await db.from("products").select("id,title,price,mrp,sale_price,stock,image_url,status,category_id,categories:category_id(name)").eq("seller_id",user.id).order("created_at",{ascending:false});$("sellerBody").innerHTML=(r.data||[]).map(p=>`<div class="adminrow"><span><b>${esc(p.title)}</b><br>${money(p.sale_price??p.price)} · stock ${p.stock} · ${p.status}</span><span><button data-edit="${p.id}">Edit</button><button data-del="${p.id}" class="danger">Delete</button></span></div>`).join("")||"<p>No products.</p>";document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>productForm(b.dataset.edit));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del))}
async function productForm(id){
 let p=id?getP(id):null;if(id&&!p){const fetched=await db.from("products").select("*").eq("id",id).maybeSingle();if(fetched.error){toast(fetched.error.message);return;}p=fetched.data;}let h=`<h2>${p?"Edit":"Add"} Product</h2><label>Title</label><input id="pt" value="${esc(p?.title||"")}"><label>Brand</label><input id="pb" value="${esc(p?.brand||"")}"><label>Category</label><select id="pc">${allCategories.map(c=>`<option value="${c.id}" ${p?.category_id===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select><label>Description</label><textarea id="pd">${esc(p?.description||"")}</textarea><div class="twocol"><div><label>MRP</label><input id="pm" type="number" value="${p?.mrp||""}"></div><div><label>Sale price</label><input id="ps" type="number" value="${p?.sale_price??p?.price??""}"></div></div><label>Stock</label><input id="pk" type="number" value="${p?.stock??0}"><label>Product image</label><input id="pi" type="file" accept="image/*"><button class="primary wide" id="saveProduct" type="button">Save Product</button><p id="pmg"></p>`;modal(h);$("saveProduct").onclick=async()=>{let m=$("pmg"),title=$("pt").value.trim(),mrp=+$("pm").value,sale=+$("ps").value,stock=+$("pk").value;if(!title||!sale){m.textContent="Title and sale price are required.";return}let image=p?.image_url||null,file=$("pi").files[0];if(file){let path=(user.id)+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),up=await db.storage.from("product-images").upload(path,file,{upsert:false});if(up.error){m.textContent=up.error.message;return}image=db.storage.from("product-images").getPublicUrl(path).data.publicUrl}let data={title,brand:$("pb").value.trim()||null,category_id:$("pc").value,description:$("pd").value.trim(),mrp,sale_price:sale,price:sale,stock,image_url:image,status:"active",seller_id:user.id};let x=id?await db.from("products").update(data).eq("id",id):await db.from("products").insert(data);m.textContent=x.error?x.error.message:"Saved ✓";if(!x.error){await load();setTimeout(closeModal,600)}} }async function deleteProduct(id){
 if(!confirm("Delete this product?"))return;
 let p=getP(id),x=await db.from("products").delete().eq("id",id);
 if(x.error){toast(x.error.message);return}
 if(p?.image_url){try{let u=new URL(p.image_url);let marker="/product-images/";let i=u.pathname.indexOf(marker);if(i>=0)await db.storage.from("product-images").remove([decodeURIComponent(u.pathname.slice(i+marker.length))])}catch(e){}}
 await load();sellerProducts()
}
async function sellerOrders(){
 const host=$("sellerBody");
 if(!host){modal("<h2>My Store Orders</h2><div id='sellerBody'>Loading orders…</div>");}
 const target=$("sellerBody");target.innerHTML="<p>Loading your store orders…</p>";
 const r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,delivery_address,created_at,order_items(product_title,unit_price,quantity,seller_id,seller_amount)").order("created_at",{ascending:false});
 if(r.error){target.innerHTML="<p class='notice'>Could not load seller orders: "+esc(r.error.message)+"</p><button class='dash wide' id='sellerOrdersRetry'>Try again</button>";$("sellerOrdersRetry").onclick=sellerOrders;return}
 const orders=(r.data||[]).map(o=>({...o,ownItems:(o.order_items||[]).filter(i=>String(i.seller_id)===String(user.id))})).filter(o=>o.ownItems.length);
 target.innerHTML=orders.map(o=>{
  const total=o.ownItems.reduce((sum,i)=>sum+Number(i.seller_amount??Number(i.unit_price)*Number(i.quantity)*.9),0);
  return `<article class="order" style="margin:10px 0;padding:14px;border:1px solid var(--border,#ddd);border-radius:12px">
   <b>${esc(o.order_number)}</b> <span class="status">${esc(String(o.status||"placed").toUpperCase())}</span>
   <p><b>Customer:</b> ${esc(o.delivery_address?.name||"Customer")} · ${esc(o.delivery_address?.phone||"")}</p>
   <p><b>Delivery address:</b> ${esc(o.delivery_address?.address||"Not provided")}</p>
   <div>${o.ownItems.map(i=>`<div class="lineitem"><span>${esc(i.product_title)} × ${Number(i.quantity)}</span><b>${money(Number(i.unit_price)*Number(i.quantity))}</b></div>`).join("")}</div>
   <div class="lineitem"><span>Estimated seller amount (after 10% commission)</span><b>${money(total)}</b></div>
   <small>${new Date(o.created_at).toLocaleString("en-IN")} · ${esc(String(o.payment_method||"cod").toUpperCase())} · Payment: ${esc(o.payment_status||"pending")}</small>
  </article>`;
 }).join("")||"<p>No orders for your store yet.</p>";
 const refresh=document.createElement("button");refresh.className="dash wide";refresh.type="button";refresh.textContent="Refresh my store orders";refresh.onclick=sellerOrders;target.appendChild(refresh);
}
async function adminPanel(){
 if(profile?.role!=="admin"){toast("Admin access only");return}
 modal("<h2>Admin Dashboard</h2><div class='dashgrid'><button class='dash' id='admS'>Sellers</button><button class='dash' id='admP'>Products</button><button class='dash' id='admO'>Orders</button></div><div id='adminBody'></div>");$("admS").onclick=adminSellers;$("admP").onclick=adminProducts;$("admO").onclick=adminOrders}
async function adminSellers(){
 const body=$("adminBody");body.innerHTML="<p>Loading seller applications…</p>";
 try{
  const r=await db.from("seller_profiles").select("*").order("created_at",{ascending:false});
  if(r.error){body.innerHTML="<p class='notice'>Could not load sellers: "+esc(r.error.message)+"</p><button class='dash' id='sellerRetry' type='button'>Retry</button>";$("sellerRetry").onclick=adminSellers;return;}
  body.innerHTML=(r.data||[]).map(s=>`<div class="adminrow"><span><b>${esc(s.store_name)}</b><br>${esc(s.status)} · ${s.commission_percent}%</span><span><button type="button" data-as="${s.user_id}" data-st="approved" ${s.status==="approved"?"disabled":""}>Approve</button><button type="button" data-as="${s.user_id}" data-st="rejected" class="danger" ${s.status==="rejected"?"disabled":""}>Reject</button></span></div>`).join("")||"<p>No seller applications.</p>";
  body.querySelectorAll("[data-as]").forEach(b=>b.onclick=async()=>{
   const userId=b.dataset.as,status=b.dataset.st;
   if(!userId){body.insertAdjacentHTML("afterbegin","<p class='notice'>Seller account ID is missing. Refresh and try again.</p>");return;}
   body.querySelectorAll("[data-as]").forEach(x=>x.disabled=true);
   let result;
   try{result=await db.from("seller_profiles").update({status}).eq("user_id",userId).select("user_id,status").maybeSingle();}
   catch(err){body.insertAdjacentHTML("afterbegin","<p class='notice'>Approval failed: "+esc(err?.message||"Connection error")+"</p>");return;}
   if(result.error){body.insertAdjacentHTML("afterbegin","<p class='notice'>Approval failed: "+esc(result.error.message)+"</p>");}
   else if(!result.data){body.insertAdjacentHTML("afterbegin","<p class='notice'>No seller record was updated. Check that you are logged in with the admin account.</p>");}
   else{toast(status==="approved"?"Seller approved ✓":"Seller rejected");}
   await adminSellers();
  });
 }catch(err){console.error("RETAIL adminSellers failed:",err);body.innerHTML="<p class='notice'>Could not open seller applications: "+esc(err?.message||"Unknown error")+"</p><button class='dash' id='sellerRetry' type='button'>Retry</button>";$("sellerRetry").onclick=adminSellers;}
}
async function adminProducts(){let r=await db.from("products").select("id,title,sale_price,stock,status,seller_id,profiles:seller_id(full_name),categories:category_id(name)").order("created_at",{ascending:false});if(r.error){$("adminBody").innerHTML="<p class=notice>Could not load products: "+esc(r.error.message)+"</p><button class=primary id=adminRetry>Retry</button>";$("adminRetry").onclick=adminProducts;return;}$("adminBody").innerHTML=`<button class="primary" id="adminAdd">Add product</button>`+(r.data||[]).map(p=>`<div class="adminrow"><span><b>${esc(p.title)}</b><br>${money(p.sale_price??0)} · ${p.stock} · ${p.status} · ${esc(p.profiles?.full_name||"")}</span><span><button data-ap="${p.id}">Edit</button><button data-adp="${p.id}" class="danger">Delete</button></span></div>`).join("");$("adminAdd").onclick=()=>productForm();document.querySelectorAll("[data-ap]").forEach(b=>b.onclick=()=>productForm(b.dataset.ap));document.querySelectorAll("[data-adp]").forEach(b=>b.onclick=async()=>{if(confirm("Delete product?")){let d=await db.from("products").delete().eq("id",b.dataset.adp);if(d.error){alert("Delete failed: "+d.error.message);return}toast("Product deleted ✓");await load();adminProducts()}})}
async function adminOrderDetail(orderId){
 const host=$("adminBody");
 host.innerHTML="<p>Loading order details…</p>";
 const r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,platform_commission,delivery_address,created_at,order_items(product_title,unit_price,quantity,seller_amount,commission_amount)").eq("id",orderId).maybeSingle();
 if(r.error||!r.data){host.innerHTML="<button class='dash' id='orderBack'>← Back to orders</button><p class='notice'>Could not load this order: "+esc(r.error?.message||"Order not found")+"</p>";$("orderBack").onclick=adminOrders;return}
 const o=r.data, s=String(o.status||"placed").toLowerCase();
 const labels={placed:"Pending",pending:"Pending",confirmed:"Confirmed",packed:"Packed",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled"};
 const label=labels[s]||s;
 const tone=s==="delivered"?"#16803c":s==="cancelled"?"#c62828":s==="shipped"?"#0757c9":"#8a5a00";
 const address=o.delivery_address||{};
 host.innerHTML=`<button class="dash wide" id="orderBack">← Back to all orders</button>
 <section class="order" style="margin-top:14px;padding:16px">
 <h2 style="margin:0 0 8px">Order details</h2>
 <p><b>Order ID:</b> ${esc(o.order_number)}</p>
 <p><b>Current status:</b> <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${tone}18;color:${tone};font-weight:700">${esc(label)}</span></p>
 <p><b>Order date:</b> ${esc(new Date(o.created_at).toLocaleString("en-IN"))}</p>
 <hr>
 <h3>Customer details</h3>
 <p><b>Name:</b> ${esc(address.name||"Not provided")}</p>
 <p><b>Mobile:</b> ${esc(address.phone||"Not provided")}</p>
 <p><b>Address:</b> ${esc(address.address||"Not provided")}</p>
 <hr>
 <h3>Products ordered</h3>
 ${(o.order_items||[]).map(i=>`<div class="lineitem"><span>${esc(i.product_title)} × ${Number(i.quantity||0)}</span><b>${money(Number(i.unit_price||0)*Number(i.quantity||0))}</b></div>`).join("")||"<p>Product details unavailable.</p>"}
 <div class="lineitem" style="margin-top:12px"><b>Total amount</b><b>${money(o.subtotal)}</b></div>
 <p><b>Payment:</b> ${esc(String(o.payment_method||"cod").toUpperCase())} · ${esc(o.payment_status||"pending")}</p>
 <hr><h3>Update order status</h3>
 <label for="detailOrderStatus">Choose new status</label>
 <select id="detailOrderStatus">
 <option value="placed" ${s==="placed"||s==="pending"?"selected":""}>Pending</option>
 <option value="confirmed" ${s==="confirmed"?"selected":""}>Confirmed</option>
 <option value="packed" ${s==="packed"?"selected":""}>Packed</option>
 <option value="shipped" ${s==="shipped"?"selected":""}>Shipped</option>
 <option value="delivered" ${s==="delivered"?"selected":""}>Delivered</option>
 <option value="cancelled" ${s==="cancelled"?"selected":""}>Cancelled</option>
 </select>
 <button class="primary wide" id="saveOrderStatus" type="button" style="margin-top:10px">Save status</button><p id="orderStatusMessage" role="status"></p>
 </section>`;
 $("orderBack").onclick=adminOrders;
 $("saveOrderStatus").onclick=async()=>{
  const btn=$("saveOrderStatus"),msg=$("orderStatusMessage"),next=$("detailOrderStatus").value;
  btn.disabled=true;msg.textContent="Saving status…";
  const x=await db.from("orders").update({status:next}).eq("id",o.id);
  if(x.error){msg.textContent="Status update failed: "+x.error.message;btn.disabled=false;return}
  toast("Order status updated.");
  await adminOrderDetail(o.id);
 };
}
async function adminOrders(){
 const host=$("adminBody");
 host.innerHTML="<p>Loading orders…</p>";
 const r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,delivery_address,created_at,order_items(product_title,quantity)").order("created_at",{ascending:false});
 if(r.error){host.innerHTML="<p class='notice'>Orders could not be loaded: "+esc(r.error.message)+"</p><button class='dash' id='adminOrdersRetry' type='button'>Try again</button>";$("adminOrdersRetry").onclick=adminOrders;return}
 const labels={placed:"Pending",pending:"Pending",confirmed:"Confirmed",packed:"Packed",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled"};
 host.innerHTML=(r.data||[]).map(o=>{
  const s=String(o.status||"placed").toLowerCase(),label=labels[s]||s;
  const tone=s==="delivered"?"#16803c":s==="cancelled"?"#c62828":s==="shipped"?"#0757c9":"#8a5a00";
  return `<button type="button" class="order" data-open-order="${esc(o.id)}" style="display:block;width:100%;text-align:left;cursor:pointer;margin:10px 0;padding:14px;background:var(--card,#fff);color:inherit;border:1px solid var(--border,#ddd);border-radius:12px">
   <b>${esc(o.order_number)}</b> · ${money(o.subtotal)} · COD
   <span style="display:inline-block;margin:7px 0;padding:4px 9px;border-radius:999px;background:${tone}18;color:${tone};font-weight:700">Status: ${esc(label)}</span>
   <br><small>${esc(o.delivery_address?.name||"")} · ${esc(o.delivery_address?.phone||"")} · ${esc(o.delivery_address?.address||"")}</small>
   <br><small>${(o.order_items||[]).map(i=>esc(i.product_title)+" × "+i.quantity).join(", ")}</small>
   <p style="margin:8px 0 0;font-weight:700">Tap to view order details and update status →</p>
  </button>`;
 }).join("")||"<p>No orders yet.</p>";
 host.querySelectorAll("[data-open-order]").forEach(btn=>btn.addEventListener("click",()=>adminOrderDetail(btn.dataset.openOrder)));
 const refresh=document.createElement("button");refresh.className="dash wide";refresh.type="button";refresh.textContent="Refresh orders";refresh.onclick=adminOrders;host.appendChild(refresh);
}


// RETAIL startup and main navigation wiring.
(function initRetailApp(){
  function bind(id,event,handler){
    const el=document.getElementById(id);
    if(el)el.addEventListener(event,handler);
  }
  bind("loginBtn","click",()=>auth());
  bind("accountBtn","click",()=>account());
  bind("adminNavBtn","click",()=>adminPanel());
  bind("cartBtn","click",()=>cartModal());
  bind("searchBtn","click",()=>render());
  bind("search","input",()=>render());
  bind("shopNowBottom","click",()=>{showCatalogue(true);document.getElementById("catalogHeading")?.scrollIntoView({behavior:"smooth"});});
  const catsEl=document.getElementById("cats");
  if(catsEl)catsEl.addEventListener("click",e=>{
    const btn=e.target.closest("[data-cat]");
    if(!btn)return;
    active=btn.dataset.cat||"All";
    renderCats();
    render();
  });
  saveCart();
  refreshUser().catch(err=>console.warn("RETAIL initial account check failed:",err)).finally(()=>{
    syncAccountButtons();
    startProductAlerts();
  });
  load();
})();
