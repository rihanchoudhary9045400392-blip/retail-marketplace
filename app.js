const SUPABASE_URL="https://oebapdfkaumpmwdblqbv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_wmNek6qB6MCiPIJzueJhVQ_7-6d42yl";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const incomingReferral=new URLSearchParams(location.search).get("ref");if(incomingReferral&&/^[A-Z0-9]{6,12}$/i.test(incomingReferral)){try{localStorage.setItem("retail_referral_code",incomingReferral.toUpperCase())}catch(e){}}
const $=id=>document.getElementById(id), money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
let products=[],categories=[],allCategories=[],cart=JSON.parse(localStorage.getItem("retail_cart")||"[]"),active="All",user=null,profile=null,productAlertChannel=null,customerLocation=null,sellerLocations={};
const sample=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function modal(h){$("modalBody").innerHTML=h;/* The modal is wrapped in a method=dialog form. Prevent dashboard/action buttons from accidentally submitting and closing it. */$("modalBody").querySelectorAll("button:not(.close)").forEach(b=>{if(!b.hasAttribute("type"))b.type="button"});$("modal").showModal()}
function closeModal(){if($("modal").open)$("modal").close()}
function syncAccountButtons(){ $("loginBtn").hidden=!!user; $("accountBtn").hidden=!user; const a=$("adminNavBtn"); if(a)a.hidden=!(user&&profile?.role==="admin"); }
function off(p){let m=Number(p.mrp||p.price||0),s=Number(p.sale_price||p.price||0);return m>s?Math.round((m-s)*100/m):0}
function saveCart(){try{localStorage.setItem("retail_cart",JSON.stringify(cart))}catch(e){console.warn("RETAIL cart storage unavailable:",e)}const count=$("cartCount");if(count)count.textContent=cart.reduce((n,x)=>n+Number(x.qty||0),0)}
function getGpsPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation)return reject(new Error("GPS is not supported by this browser."));navigator.geolocation.getCurrentPosition(pos=>resolve({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:Math.round(pos.coords.accuracy||0)}),err=>reject(new Error(err.code===1?"Location permission denied. Allow location in browser settings.":err.code===2?"Location unavailable. Turn on device location.":"GPS timed out. Try again.")),{enableHighAccuracy:true,timeout:15000,maximumAge:60000})})}
function distanceKm(a,b){if(!a||!b||a.latitude==null||a.longitude==null||b.latitude==null||b.longitude==null)return null;const r=x=>x*Math.PI/180,dl=r(b.latitude-a.latitude),dn=r(b.longitude-a.longitude),v=Math.sin(dl/2)**2+Math.cos(r(a.latitude))*Math.cos(r(b.latitude))*Math.sin(dn/2)**2;return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v))}
function mapLink(lat,lon){return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(Number(lat)+","+Number(lon))}
function price(p){return Number(p.sale_price??p.price??0)}
function renderCats(){const host=$("cats");if(!host)return;let list=["All",...categories.map(c=>c.name).filter(Boolean)];host.innerHTML=list.map(c=>`<button class="${active===c?"selected":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
function retailNormalize(s){return String(s||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(" ").filter(Boolean).join(" ")}
function retailEditDistance(a,b){if(Math.abs(a.length-b.length)>3)return 99;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function retailMatches(text,query){const q=retailNormalize(query);if(!q)return true;const hay=retailNormalize(text);if(hay.includes(q))return true;const qs=q.split(" "),hs=hay.split(" ");return qs.every(token=>hs.some(word=>word.startsWith(token)||retailEditDistance(token,word)<=Math.max(1,Math.floor(token.length/3))))}
function render(){
 const q=($("search")?.value||"").trim().toLowerCase();
 const shown=products.filter(p=>(active==="All"||p.category===active)&&(!q||retailMatches([p.title,p.brand,p.category,p.description].join(" "),q)));
 const resultCount=$("resultCount");if(resultCount)resultCount.textContent=shown.length+" items";
 const productHost=$("products");if(productHost)productHost.innerHTML=shown.map(p=>{const o=off(p);return `<article class="product" data-product="${p.id}"><div class="photo">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:(p.emoji||"📦")}</div><div class="pbody"><div class="tag">${esc(p.category||"Other")}</div><h3>${esc(p.title)}</h3><div class="prices"><b>${money(price(p))}</b> ${o?`<span class="off">${o}% OFF</span>`:""}</div><div class="seller">Sold by ${esc(p.seller_name||"Marketplace seller")} · Stock ${Number(p.stock??0)}</div><div class="actions"><button class="add" data-add="${p.id}">Add to cart</button><button class="buy" data-buy="${p.id}">Buy Now</button></div></div></article>`}).join("")||"<div class='empty'>No products found.</div>";
 document.querySelectorAll("[data-product]").forEach(x=>x.onclick=e=>{if(!e.target.closest("button"))showProduct(x.dataset.product)});
 document.querySelectorAll("[data-add]").forEach(b=>b.onclick=e=>{e.stopPropagation();addToCart(b.dataset.add)});
 document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async e=>{e.stopPropagation();let p=getP(b.dataset.buy);if(p)await checkout([{id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty:1}])});
 saveCart();
}
function getP(id){return products.find(p=>String(p.id)===String(id))}
function addToCart(id,qty=1){
 const p=getP(id);
 if(!p||String(id).startsWith("sample")){modal("<h2>Product unavailable</h2><p>Please refresh the live catalogue and try again.</p>");return}
 const stock=Math.max(0,Math.floor(Number(p.stock)||0));
 if(stock<1){toast("This product is out of stock.");return}
 const key=String(p.id),existing=cart.find(i=>String(i.id)===key),wanted=Math.max(1,Math.floor(Number(qty)||1));
 if(existing){
  if(existing.qty>=stock){toast("Only "+stock+" item(s) available.");return}
  existing.qty=Math.min(existing.qty+wanted,stock);
  existing.title=p.title;existing.price=price(p);existing.image_url=p.image_url;existing.seller_id=p.seller_id;
 }else cart.push({id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty:Math.min(wanted,stock)});
 saveCart();toast("Added to cart ✓");
}
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
   if(!email){if(m)m.textContent="Enter your account email first.";return;}
   if(m)m.textContent="Sending password reset link…";
   const r=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
   if(m)m.textContent=r.error?r.error.message:"If this email has a RETAIL account, a password reset link has been sent. Check inbox and spam.";
  };
  $("resendVerify").onclick=async()=>{
   const email=$("email").value.trim(),m=$("authMsg");
   if(!email){if(m)m.textContent="Enter your account email first.";return;}
   if(m)m.textContent="Sending verification email…";
   const r=await db.auth.resend({type:"signup",email,options:{emailRedirectTo:location.origin+location.pathname}});
   if(m)m.textContent=r.error?r.error.message:"If this account needs verification, a new confirmation email has been sent. Check inbox and spam.";
  };
  go.onclick=async()=>{
   const email=$("email").value.trim(),password=$("password").value,n=$("fullName").value.trim(),ph=$("phone").value.trim(),m=$("authMsg");
   if(!email||password.length<6){if(m)m.textContent="Enter a valid email and a password of at least 6 characters.";return;}
   go.disabled=true;go.textContent="Please wait…";if(m)m.textContent="Connecting securely…";
   try{
    let r=await db.auth.signInWithPassword({email,password});
    if(!r.error){
     await refreshUser(r.data.user);
     if(!user){if(m)m.textContent="Login returned without an active session. Please refresh and try again.";return;}
     closeModal();syncAccountButtons();toast("Logged in ✓");await account();return;
    }
    const loginError=r.error;
    if(!/invalid login credentials|email not confirmed|user not found/i.test(loginError.message||"")){
     if(m)m.textContent=loginError.message||"Login failed. Please try again.";return;
    }
    if(/email not confirmed/i.test(loginError.message||"")){
     if(m)m.textContent="Please verify your email from the confirmation message, then log in again.";return;
    }
    r=await db.auth.signUp({email,password,options:{data:{full_name:n,phone:ph,referral_code:(localStorage.getItem("retail_referral_code")||"")}}});
    if(r.error){if(m)m.textContent=(/already registered|already exists/i.test(r.error.message||""))?"This email already has an account. Check your password or use Forgot Password in Supabase.":r.error.message;return;}
    if(r.data?.session){
     await db.from("profiles").upsert({id:r.data.user.id,full_name:n||email.split("@")[0],phone:ph||null,role:"customer"});
     await refreshUser();closeModal();toast("Account created & logged in ✓");account();return;
    }
    if(m)m.textContent="Account created. Check your email for a verification link, verify it, then return here and log in.";
   }catch(err){console.error("RETAIL auth action failed:",err);if(m)m.textContent=err?.message||"Could not connect. Check your internet and try again.";}
   finally{go.disabled=false;go.textContent="Login / Create account";}
  };
 }catch(err){console.error("RETAIL auth form failed:",err);alert("Could not open RETAIL login. Please refresh the page and try again.");}
}
async function account(){
 if(!user){auth();return}
 const isAdmin=profile?.role==="admin";
 if(isAdmin){
  modal(`<h2>RETAIL · Admin Control Center</h2><p><b>Administrator</b><br>${esc(profile?.full_name||"Admin")}<br>${esc(user.email||"")}</p><p class="notice">Private administrator workspace — store management, order oversight and seller controls. This is not a customer profile.</p><div class="dashgrid"><button class="dash" id="admProfileOrders">📦 All Orders & Status</button><button class="dash" id="admProfileProducts">🛍️ All Products</button><button class="dash" id="admProfileSellers">👥 Seller Management</button><button class="dash" id="admProfilePanel">📊 Admin Dashboard</button><button class="dash" id="admProfileLogout">🔐 Sign Out</button></div><div id="adminBody"></div>`);
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
 modal(`<h2>COD Checkout</h2><div class="notice"><b>Cash on Delivery only.</b><br>No UPI or online payment is collected.</div><div class="summary">${items.map(i=>`<div class="lineitem"><span>${esc(i.title)} × ${i.qty}</span><b>${money(i.price*i.qty)}</b></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(total)}</b></div></div><label>Full name</label><input id="coName" value="${esc(profile?.full_name||"")}"><label>Mobile</label><input id="coPhone" value="${esc(profile?.phone||"")}" inputmode="tel"><label>Delivery address</label><textarea id="coAddress" rows="4" placeholder="House, village/city, district, PIN"></textarea><button class="dash wide" id="coGps" type="button">📍 Use GPS for delivery location</button><p id="coGpsStatus" style="font-size:12px;color:#64748b">GPS optional. Please confirm your written address.</p><button class="primary wide" id="placeOrder" type="button">Place COD Order</button><p id="coMsg" role="status" aria-live="polite"></p>`);
 $("coGps").onclick=async()=>{const status=$("coGpsStatus");try{customerLocation=await getGpsPosition();status.textContent="GPS captured (±"+customerLocation.accuracy+" m). Confirm the written address.";const a=$("coAddress");if(a&&!a.value.trim())a.value="GPS location ("+customerLocation.latitude.toFixed(6)+", "+customerLocation.longitude.toFixed(6)+")"}catch(e){status.textContent=e.message;toast(e.message)}};
 $("placeOrder").onclick=async()=>{
  let n=$("coName").value.trim(),ph=$("coPhone").value.trim(),addr=$("coAddress").value.trim(),m=$("coMsg");
  if(!n||!/^[0-9]{10}$/.test(ph)||!addr){if(m)m.textContent="Enter name, valid 10-digit mobile and full address.";return}
  const btn=$("placeOrder");btn.disabled=true;if(m)m.textContent="Checking latest price and stock…";
  try{
   const latest=await db.from("products").select("id,title,price,sale_price,stock,status,seller_id").in("id",ids);
   if(latest.error)throw new Error(latest.error.message);
   const latestById=new Map((latest.data||[]).map(p=>[String(p.id),p]));
   for(const item of items){
    const p=latestById.get(String(item.id));
    if(!p||p.status!=="active"||Number(p.stock??0)<item.qty){if(m)m.textContent="A product is no longer available or stock has changed. Close checkout, update your cart, and try again.";btn.disabled=false;return}
    if(price(p)!==Number(item.price)){if(m)m.textContent="The price of "+p.title+" has changed. Close checkout and reopen it to confirm the new total.";btn.disabled=false;return}
    if(!p.seller_id){if(m)m.textContent="Order unavailable: seller details are missing for "+p.title+".";btn.disabled=false;return}
   }
   if(m)m.textContent="Placing order…";
   const number="RET"+Date.now().toString().slice(-10);
   const o=await db.from("orders").insert({customer_id:user.id,order_number:number,status:"placed",payment_method:"cod",payment_status:"pending",subtotal:total,platform_commission:total*.10,delivery_address:{name:n,phone:ph,address:addr,latitude:customerLocation?.latitude??null,longitude:customerLocation?.longitude??null,location_accuracy_m:customerLocation?.accuracy??null}}).select("id,order_number").single();
   if(o.error)throw new Error(o.error.message);
   const rows=items.map(i=>({order_id:o.data.id,product_id:i.id,seller_id:i.seller_id,product_title:i.title,unit_price:i.price,quantity:i.qty,seller_amount:i.price*i.qty*.90,commission_amount:i.price*i.qty*.10}));
   const ir=await db.from("order_items").insert(rows);
   if(ir.error){await db.from("orders").delete().eq("id",o.data.id);throw new Error(ir.error.message)}
   if(items.every(i=>cart.some(c=>String(c.id)===String(i.id)))){cart=[];saveCart()}
   closeModal();notifyWhatsApp(o.data.order_number,items,total,n,ph,addr);
  }catch(err){if(m)m.textContent=err?.message||"Could not place order. Please try again.";btn.disabled=false}
 };
}
function notifyWhatsApp(orderNumber,items,total,name,phone,address){
 const text="RETAIL ORDER "+orderNumber+"\n"+items.map(i=>i.title+" x "+i.qty+" = ₹"+(i.price*i.qty)).join("\n")+"\nTotal: ₹"+total+"\nPayment: Cash on Delivery\nCustomer: "+name+"\nMobile: "+phone+"\nAddress: "+address;
 modal('<h2>Order placed ✓</h2><p>Your COD order <b>'+esc(orderNumber)+'</b> has been saved.</p><p class="notice">Tap below to send the order details to RETAIL WhatsApp. WhatsApp will ask you to press Send.</p><a class="primary wide waLink" target="_blank" rel="noopener" href="https://wa.me/919045400392?text='+encodeURIComponent(text)+'">Send order to WhatsApp</a><button class="dash wide" id="doneOrder" type="button">Done</button>');
 $("doneOrder").onclick=closeModal;
}
function cartModal(){
 if(!cart.length){modal("<h2>Your cart is empty</h2><p>Choose a live product to add it here.</p>");return}
 // Reconcile cart rows with the latest catalogue where available.
 cart=cart.filter(i=>i&&i.id);
 cart.forEach(i=>{const p=getP(i.id);if(p){i.title=p.title;i.price=price(p);i.image_url=p.image_url;i.seller_id=p.seller_id}});
 saveCart();
 const h=`<h2>Your Cart</h2>${cart.map((i,idx)=>`<div class="cartrow"><div><b>${esc(i.title)}</b><br><small>${money(i.price)} each · Subtotal ${money(Number(i.price)*Number(i.qty))}</small></div><div class="qty"><button type="button" data-q="${idx}" data-d="-1" ${Number(i.qty)<=1?"disabled":""}>−</button><b>${i.qty}</b><button type="button" data-q="${idx}" data-d="1">+</button><button type="button" class="remove" data-r="${idx}">×</button></div></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(cart.reduce((sum,i)=>sum+Number(i.price||0)*Number(i.qty||0),0))}</b></div><button class="primary wide" id="checkoutBtn" type="button">Checkout — COD</button><p class="notice">Prices and stock are checked again before the order is placed.</p>`;
 modal(h);
 document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{
  const i=cart[Number(b.dataset.q)];if(!i)return;
  const p=getP(i.id),stock=Math.max(0,Math.floor(Number(p?.stock??0)));
  if(Number(b.dataset.d)>0){if(!p||stock<=Number(i.qty)){toast("Only "+stock+" item(s) available.");return}i.qty++}
  else i.qty=Math.max(1,Number(i.qty)-1);
  if(p){i.price=price(p);i.title=p.title}
  saveCart();cartModal();
 });
 document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{cart.splice(Number(b.dataset.r),1);saveCart();cartModal()});
 $("checkoutBtn").onclick=()=>checkout([...cart].map(i=>({...i})));
}
function showProduct(id,buy=false){
 const p=getP(id); if(!p)return;
 const related=products.filter(x=>String(x.id)!==String(p.id)&&x.category===p.category).slice(0,4);
 const page=$("productPage");
 if(!page){modal("<h2>Product details unavailable</h2><p>Please refresh Retail.</p>");return;}
 const heroSection=$("heroSection"); if(heroSection)heroSection.hidden=true; const catalogHeading=$("catalogHeading"); if(catalogHeading)catalogHeading.hidden=true; const productsGrid=$("products"); if(productsGrid)productsGrid.hidden=true; const allListings=$("allListings"); if(allListings)allListings.hidden=true; const allLayout=document.querySelector(".all-market-layout"); if(allLayout)allLayout.hidden=true; const shortcuts=document.querySelector(".marketplace-shortcuts"); if(shortcuts)shortcuts.hidden=true; page.hidden=false;
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
 const heroSection=$("heroSection");if(heroSection)heroSection.hidden=false;$("catalogHeading").hidden=false;$("products").hidden=false;const allListings=$("allListings");if(allListings)allListings.hidden=false;const allLayout=document.querySelector(".all-market-layout");if(allLayout)allLayout.hidden=false;const shortcuts=document.querySelector(".marketplace-shortcuts");if(shortcuts)shortcuts.hidden=false;
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
 if(!sp){modal(`<h2>Become a seller</h2><p>Apply once. After admin approval you can list products.</p><label>Store name</label><input id="storeName" placeholder="Your store"><button class="primary wide" id="applySeller">Submit application</button><p id="sellerMsg"></p>`);$("applySeller").onclick=async()=>{let s=$("storeName").value.trim(),m=$("sellerMsg");if(!s){if(m)m.textContent="Enter store name.";return}let x=await db.from("seller_profiles").insert({user_id:user.id,store_name:s,status:"pending",commission_percent:10});if(m)m.textContent=x.error?x.error.message:"Application submitted. Wait for admin approval.";};return}
 let approved=sp.status==="approved";modal(`<h2>Seller Dashboard</h2><p>Store: <b>${esc(sp.store_name)}</b> · Status: <b>${esc(sp.status)}</b> · Commission: 10%</p>${approved?`<button class="primary wide" id="addProduct">Add Product</button><button class="dash wide" id="myProducts">My Products</button><button class="dash wide" id="sellerOrders">Seller Orders</button><div id="sellerBody"></div>`:"<p class='notice'>Admin approval is required before you can add products.</p>"}`);if(approved){$("addProduct").onclick=()=>productForm();$("myProducts").onclick=()=>sellerProducts();$("sellerOrders").onclick=()=>sellerOrders()}}
async function sellerProducts(){
 let r=await db.from("products").select("id,title,price,mrp,sale_price,stock,image_url,status,category_id,categories:category_id(name)").eq("seller_id",user.id).order("created_at",{ascending:false});$("sellerBody").innerHTML=(r.data||[]).map(p=>`<div class="adminrow"><span><b>${esc(p.title)}</b><br>${money(p.sale_price??p.price)} · stock ${p.stock} · ${p.status}</span><span><button data-edit="${p.id}">Edit</button><button data-del="${p.id}" class="danger">Delete</button></span></div>`).join("")||"<p>No products.</p>";document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>productForm(b.dataset.edit));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del))}
async function productForm(id){
 if(!user){auth();return}
 let p=id?getP(id):null;
 if(id&&!p){
  const fetched=await db.from("products").select("*").eq("id",id).maybeSingle();
  if(fetched.error){modal("<h2>Could not load product</h2><p>"+esc(fetched.error.message)+"</p>");return}
  p=fetched.data;
 }
 if(id&&!p){modal("<h2>Product not found</h2><p>Refresh the product list and try again.</p>");return}
 if(!allCategories.length){
  const c=await db.from("categories").select("id,name,slug").order("name");
  if(!c.error){allCategories=c.data||[];categories=allCategories}
 }
 const categoryOptions=`<option value="">Choose category</option>`+allCategories.map(c=>`<option value="${esc(c.id)}" ${String(p?.category_id||"")===String(c.id)?"selected":""}>${esc(c.name)}</option>`).join("");
 const h=`<h2>${p?"Edit":"Add"} Product</h2>
 <label for="pt">Product title *</label><input id="pt" maxlength="160" value="${esc(p?.title||"")}" placeholder="Product name" required>
 <label for="pb">Brand</label><input id="pb" maxlength="100" value="${esc(p?.brand||"")}" placeholder="Brand name">
 <label for="pc">Category</label><select id="pc">${categoryOptions}</select>
 <label for="pd">Description</label><textarea id="pd" rows="4" maxlength="3000" placeholder="Product details">${esc(p?.description||"")}</textarea>
 <div class="twocol"><div><label for="pm">MRP (₹)</label><input id="pm" type="number" min="0" step="0.01" value="${p?.mrp??""}" placeholder="Optional"></div><div><label for="ps">Sale price (₹) *</label><input id="ps" type="number" min="0.01" step="0.01" value="${p?.sale_price??p?.price??""}" placeholder="Selling price" required></div></div>
 <label for="pk">Stock quantity *</label><input id="pk" type="number" min="0" step="1" value="${p?.stock??0}" required>
 <label for="pi">Product image ${p?.image_url?"(choose only to replace current image)":"(optional)"}</label><input id="pi" type="file" accept="image/*">
 ${p?.image_url?`<p><img src="${esc(p.image_url)}" alt="Current product image" style="width:88px;height:88px;object-fit:contain;border:1px solid #ddd;border-radius:10px"></p>`:""}
 <button class="primary wide" id="saveProduct" type="button">Save Product</button><p id="pmg" role="status" aria-live="polite"></p>`;
 modal(h);
 $("saveProduct").onclick=async()=>{
  const msg=text=>{const node=$("pmg");if(node?.isConnected)node.textContent=text;else toast(text)};
  const btn=$("saveProduct");
  const title=$("pt").value.trim(),brand=$("pb").value.trim(),categoryId=$("pc").value||null,description=$("pd").value.trim();
  const mrpRaw=$("pm").value.trim(),saleRaw=$("ps").value.trim(),stockRaw=$("pk").value.trim();
  const sale=Number(saleRaw),mrp=mrpRaw===""?null:Number(mrpRaw),stock=Number(stockRaw);
  if(!title){msg("Product title is required.");return}
  if(!saleRaw||!Number.isFinite(sale)||sale<=0){msg("Enter a valid sale price greater than ₹0.");return}
  if(mrp!==null&&(!Number.isFinite(mrp)||mrp<sale)){msg("MRP must be at least the sale price, or leave MRP blank.");return}
  if(!stockRaw||!Number.isInteger(stock)||stock<0){msg("Stock must be a whole number (0 or more).");return}
  const file=$("pi").files?.[0];
  if(file&&(!file.type.startsWith("image/")||file.size>5*1024*1024)){msg("Choose an image under 5 MB.");return}
  btn.disabled=true;btn.textContent="Saving…";msg("Saving product…");
  try{
   let image=p?.image_url||null;
   if(file){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=user.id+"/"+crypto.randomUUID()+"-"+safeName;
    const up=await db.storage.from("product-images").upload(path,file,{upsert:false});
    if(up.error)throw new Error("Image upload failed: "+up.error.message);
    image=db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
   }
   const data={title,brand:brand||null,category_id:categoryId,description:description||null,mrp,sale_price:sale,price:sale,stock,image_url:image,status:p?.status||"active",seller_id:p?.seller_id||user.id};
   const x=id?await db.from("products").update(data).eq("id",id):await db.from("products").insert(data);
   if(x.error)throw new Error(x.error.message);
   toast(p?"Product updated ✓":"Product added ✓");
   await load();
   if($("retailAdminFullPage")?.isConnected){closeModal();await adminProducts()}
   else if($("sellerBody")){closeModal();await sellerProducts()}
   else{msg("Saved ✓");setTimeout(closeModal,500)}
  }catch(err){msg(err?.message||"Could not save product. Please try again.");const currentBtn=$("saveProduct");if(currentBtn){currentBtn.disabled=false;currentBtn.textContent="Save Product"}}
 };
}
async function deleteProduct(id){
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
 let page=$("retailAdminFullPage");if(page)page.remove();page=document.createElement("section");page.id="retailAdminFullPage";
 page.innerHTML="<style>#retailAdminFullPage{position:fixed;inset:0;z-index:100100;background:#f3f6fb;color:#172b45;overflow:auto;padding:0 0 30px}#retailAdminFullPage *{box-sizing:border-box}#retailAdminFullPage .raf-top{position:sticky;top:0;z-index:3;background:white;border-bottom:1px solid #dce4ef;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}#retailAdminFullPage .raf-brand{font-size:20px;font-weight:900;color:#0757d9}#retailAdminFullPage .raf-sub{font-size:12px;color:#64748b}#retailAdminFullPage .raf-close,#retailAdminFullPage .raf-tab{border:1px solid #d5dfec;background:white;color:#16416f;border-radius:10px;padding:10px 12px;font-weight:800}#retailAdminFullPage .raf-tabs{display:flex;gap:8px;overflow:auto;padding:12px 16px;background:white}#retailAdminFullPage .raf-tab.active{background:#0757d9;color:white}#retailAdminFullPage .raf-content{max-width:1100px;margin:auto;padding:16px}#retailAdminFullPage .raf-welcome{background:linear-gradient(120deg,#0b56cf,#173a75);color:white;padding:20px;border-radius:16px}#retailAdminFullPage .raf-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}#retailAdminFullPage .raf-metric{background:white;border:1px solid #e1e8f1;border-radius:14px;padding:15px}#retailAdminFullPage .raf-metric small{display:block;color:#64748b}#retailAdminFullPage .raf-metric strong{display:block;font-size:24px;margin-top:5px}#retailAdminFullPage #adminBody{background:white;border:1px solid #e1e8f1;border-radius:14px;padding:14px;min-height:180px;margin-top:14px;overflow-wrap:anywhere}@media(min-width:700px){#retailAdminFullPage .raf-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}}</style>"+
 "<header class=\'raf-top\'><div><div class=\'raf-brand\'>RETAIL · Admin</div><div class=\'raf-sub\'>Private control center · "+esc(user?.email||"Authorized administrator")+"</div></div><button class=\'raf-close\' id=\'rafClose\' type=\'button\'>✕ Close</button></header>"+
 "<nav class=\'raf-tabs\'><button class=\'raf-tab active\' data-raf-tab=\'dashboard\'>Dashboard</button><button class=\'raf-tab\' data-raf-tab=\'products\'>Products</button><button class=\'raf-tab\' data-raf-tab=\'orders\'>Orders</button><button class=\'raf-tab\' data-raf-tab=\'sellers\'>Sellers</button></nav>"+
 "<main class=\'raf-content\'><section class=\'raf-welcome\'><h1 style=\'margin:0;font-size:24px\'>Admin Control Center</h1><p>Manage products, orders and seller approvals in one full-page workspace.</p></section><div class=\'raf-metrics\' id=\'rafMetrics\'><div class=\'raf-metric\'><small>Products</small><strong>—</strong></div><div class=\'raf-metric\'><small>Orders</small><strong>—</strong></div><div class=\'raf-metric\'><small>Pending sellers</small><strong>—</strong></div><div class=\'raf-metric\'><small>Order value</small><strong>—</strong></div></div><div id=\'adminBody\'>Loading dashboard…</div></main>";
 document.body.appendChild(page);$("rafClose").onclick=()=>page.remove();
 const tabs=[...page.querySelectorAll("[data-raf-tab]")];
 const activate=key=>{tabs.forEach(b=>b.classList.toggle("active",b.dataset.rafTab===key));if(key==="products")adminProducts();else if(key==="orders")adminOrders();else if(key==="sellers")adminSellers();else adminOverview()};
 tabs.forEach(b=>b.onclick=()=>activate(b.dataset.rafTab));
 async function adminOverview(){const host=$("adminBody"),metrics=$("rafMetrics");host.innerHTML="<h2>Quick actions</h2><div class=\'dashgrid\'><button class=\'dash\' id=\'rafAddProduct\'>＋ Add product</button><button class=\'dash\' id=\'rafViewProducts\'>Manage products</button><button class=\'dash\' id=\'rafViewOrders\'>Manage orders</button><button class=\'dash\' id=\'rafViewSellers\'>Seller approvals</button></div>";$("rafAddProduct").onclick=()=>productForm();$("rafViewProducts").onclick=()=>activate("products");$("rafViewOrders").onclick=()=>activate("orders");$("rafViewSellers").onclick=()=>activate("sellers");
 const a=await Promise.all([db.from("products").select("id,status"),db.from("orders").select("id,subtotal,status"),db.from("seller_profiles").select("user_id,status")]);if(!page.isConnected)return;const p=a[0].error?null:a[0].data||[],o=a[1].error?null:a[1].data||[],s=a[2].error?null:a[2].data||[];
 metrics.innerHTML="<div class=\'raf-metric\'><small>Products</small><strong>"+(p?p.length:"—")+"</strong><small>"+(p?p.filter(x=>x.status==="active").length+" active":"Load error")+"</small></div><div class=\'raf-metric\'><small>Total orders</small><strong>"+(o?o.length:"—")+"</strong><small>"+(o?o.filter(x=>!["delivered","cancelled"].includes(String(x.status).toLowerCase())).length+" in progress":"Load error")+"</small></div><div class=\'raf-metric\'><small>Pending sellers</small><strong>"+(s?s.filter(x=>x.status==="pending").length:"—")+"</strong></div><div class=\'raf-metric\'><small>Order value</small><strong>"+(o?money(o.reduce((n,x)=>n+Number(x.subtotal||0),0)):"—")+"</strong></div>";}
 activate("dashboard");
}
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
  btn.disabled=true;if(msg)msg.textContent="Saving status…";
  const x=await db.from("orders").update({status:next}).eq("id",o.id);
  if(x.error){if(msg)msg.textContent="Status update failed: "+x.error.message;btn.disabled=false;return}
  toast("Order status updated.");
  await adminOrderDetail(o.id);
 };
}
async function adminOrders(){
 const host=$("adminBody");
 host.innerHTML="<p>Loading orders…</p>";
 const r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,platform_commission,delivery_address,created_at,order_items(product_id,product_title,unit_price,quantity,seller_id,seller_amount,commission_amount)").order("created_at",{ascending:false});
 if(r.error){host.innerHTML="<p class='notice'>Orders could not be loaded: "+esc(r.error.message)+"</p><button class='dash' id='adminOrdersRetry' type='button'>Try again</button>";$("adminOrdersRetry").onclick=adminOrders;return}
 const labels={placed:"Pending",pending:"Pending",confirmed:"Confirmed",packed:"Packed",shipped:"Shipped",delivered:"Delivered",cancelled:"Cancelled"};
 const allOrders=r.data||[];
 const sellerIds=[...new Set(allOrders.flatMap(o=>(o.order_items||[]).map(i=>i.seller_id).filter(Boolean)))];
 let sellerNames={};
 if(sellerIds.length){const sr=await db.from("profiles").select("id,full_name").in("id",sellerIds);if(!sr.error)(sr.data||[]).forEach(p=>sellerNames[p.id]=p.full_name||"Seller");}
 host.innerHTML=allOrders.map(o=>{
  const s=String(o.status||"placed").toLowerCase(),label=labels[s]||s;
  const tone=s==="delivered"?"#16803c":s==="cancelled"?"#c62828":s==="shipped"?"#0757c9":"#8a5a00";
  const itemRows=(o.order_items||[]).map(i=>`<div class="lineitem" style="gap:8px"><span><b>${esc(i.product_title)}</b><br><small>Product ID: ${esc(i.product_id||"—")} · Seller: ${esc(sellerNames[i.seller_id]||i.seller_id||"Not linked")}<br>Qty: ${Number(i.quantity||0)} × ${money(i.unit_price)} · Seller amount: ${money(i.seller_amount??Number(i.unit_price||0)*Number(i.quantity||0)*.9)} · Commission: ${money(i.commission_amount??Number(i.unit_price||0)*Number(i.quantity||0)*.1)}</small></span><b>${money(Number(i.unit_price||0)*Number(i.quantity||0))}</b></div>`).join("");
  return `<article class="order" style="display:block;margin:10px 0;padding:14px;background:var(--card,#fff);color:inherit;border:1px solid var(--border,#ddd);border-radius:12px">
   <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(o.order_number)}</b><span style="padding:4px 9px;border-radius:999px;background:${tone}18;color:${tone};font-weight:700">Status: ${esc(label)}</span></div>
   <p style="margin:8px 0"><b>Order total: ${money(o.subtotal)}</b> · ${esc(String(o.payment_method||"COD").toUpperCase())} · Payment: ${esc(o.payment_status||"pending")}</p>
   <small>${esc(new Date(o.created_at).toLocaleString("en-IN"))}</small>
   <p><b>Customer:</b> ${esc(o.delivery_address?.name||"")} · ${esc(o.delivery_address?.phone||"")}<br><b>Delivery address:</b> ${esc(o.delivery_address?.address||"")}</p>
   <h4 style="margin:10px 0 4px">All products in this order (${(o.order_items||[]).length})</h4>${itemRows||"<p>Product details unavailable.</p>"}
   <button type="button" class="primary wide" data-open-order="${esc(o.id)}" style="margin-top:12px">Open full order & update status →</button>
  </article>`;
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
