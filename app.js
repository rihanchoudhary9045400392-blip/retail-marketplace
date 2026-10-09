const SUPABASE_URL="https://oebapdfkaumpmwdblqbv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_wmNek6qB6MCiPIJzueJhVQ_7-6d42yl";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id), money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
let products=[],categories=[],cart=JSON.parse(localStorage.getItem("retail_cart")||"[]"),active="All",user=null,profile=null;
const sample=[];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function modal(h){$("modalBody").innerHTML=h;$("modal").showModal()}
function closeModal(){if($("modal").open)$("modal").close()}
function off(p){let m=Number(p.mrp||p.price||0),s=Number(p.sale_price||p.price||0);return m>s?Math.round((m-s)*100/m):0}
function saveCart(){localStorage.setItem("retail_cart",JSON.stringify(cart));$("cartCount").textContent=cart.reduce((n,x)=>n+x.qty,0)}
function price(p){return Number(p.sale_price??p.price??0)}
function renderCats(){let list=["All",...categories.map(c=>c.name)];$("cats").innerHTML=list.map(c=>`<button class="${active===c?"selected":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
function render(){
 const q=$("search").value.trim().toLowerCase();
 const shown=products.filter(p=>(active==="All"||p.category===active)&&(!q||[p.title,p.brand,p.category,p.description].join(" ").toLowerCase().includes(q)));
 $("resultCount").textContent=shown.length+" items";
 $("products").innerHTML=shown.map(p=>{const o=off(p);return `<article class="product" data-product="${p.id}"><div class="photo">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}">`:(p.emoji||"📦")}</div><div class="pbody"><div class="tag">${esc(p.category||"Other")}</div><h3>${esc(p.title)}</h3><div class="prices"><b>${money(price(p))}</b> ${o?`<del>${money(p.mrp)}</del><span class="off">${o}% OFF</span>`:""}</div><div class="seller">Sold by ${esc(p.seller_name||"Marketplace seller")} · Stock ${Number(p.stock??0)}</div><div class="actions"><button class="add" data-add="${p.id}">Add to cart</button><button class="buy" data-buy="${p.id}">Buy Now</button></div></div></article>`}).join("")||"<div class='empty'>No products found.</div>";
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
  if(c.error)console.warn("RETAIL categories:",c.error.message); else categories=c.data||[];
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
  if(p.error && count)count.textContent="Database error";
 }catch(e){
  console.error("RETAIL catalogue load failed:",e);
  products=[];
  renderCats();render();
  if(count)count.textContent="Could not connect";
  if(list)list.insertAdjacentHTML("afterbegin","<div class='empty'>Could not connect to the live catalogue. Please check the database configuration.</div>");
 }
}
async function refreshUser(explicitUser=null){try{let r=explicitUser?{data:{user:explicitUser}}:await db.auth.getUser();user=r?.data?.user||null;if(user){let p=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=p.data||null;if(!profile){let meta=user.user_metadata||{};let created=await db.from("profiles").upsert({id:user.id,full_name:meta.full_name||user.email?.split("@")[0]||"RETAIL customer",phone:meta.phone||null,role:"customer"},{onConflict:"id"});if(!created.error){let again=await db.from("profiles").select("*").eq("id",user.id).maybeSingle();profile=again.data||null}}$("loginBtn").hidden=true;$("accountBtn").hidden=false;return user}else{profile=null;$("loginBtn").hidden=false;$("accountBtn").hidden=true;return null}}catch(e){console.error("RETAIL refreshUser failed:",e);$("loginBtn").hidden=!user;$("accountBtn").hidden=!!user;throw e}}
async function auth(){
 try{
  if(!window.supabase||!db){alert("RETAIL login service could not load. Refresh the page and try again.");return;}
  modal(`<h2>RETAIL account</h2><p class="notice">Login is required to place and track orders.</p><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="you@example.com"><label>Password</label><input id="password" type="password" autocomplete="current-password" minlength="6" placeholder="Minimum 6 characters"><label>Name (for new account)</label><input id="fullName" autocomplete="name" placeholder="Your name"><label>Mobile</label><input id="phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile"><button class="primary wide" id="authGo" type="button">Login / Create account</button><p id="authMsg" role="status" aria-live="polite"></p>`);
  const go=$("authGo");
  if(!go)throw new Error("Login form did not open correctly.");
  go.onclick=async()=>{
   const email=$("email").value.trim(),password=$("password").value,n=$("fullName").value.trim(),ph=$("phone").value.trim(),m=$("authMsg");
   if(!email||password.length<6){m.textContent="Enter a valid email and a password of at least 6 characters.";return;}
   go.disabled=true;go.textContent="Please wait…";m.textContent="Connecting securely…";
   try{
    let r=await db.auth.signInWithPassword({email,password});
    if(!r.error){
     await refreshUser(r.data.user);
     if(!user){m.textContent="Login returned without an active session. Please refresh and try again.";return;}
     closeModal();$("loginBtn").hidden=true;$("accountBtn").hidden=false;toast("Logged in ✓");await account();return;
    }
    const loginError=r.error;
    if(!/invalid login credentials|email not confirmed|user not found/i.test(loginError.message||"")){
     m.textContent=loginError.message||"Login failed. Please try again.";return;
    }
    if(/email not confirmed/i.test(loginError.message||"")){
     m.textContent="Please verify your email from the confirmation message, then log in again.";return;
    }
    r=await db.auth.signUp({email,password,options:{data:{full_name:n,phone:ph}}});
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
async function account(){
 if(!user){auth();return}
 let isAdmin=profile?.role==="admin", html=`<h2>My RETAIL account</h2><p><b>${esc(profile?.full_name||user.email)}</b><br>${esc(profile?.phone||"")}</p><div class="dashgrid"><button class="dash" id="ordersBtn">My Orders</button>${isAdmin?'<button class="dash" id="adminBtn">Admin Panel</button>':""}<button class="dash danger" id="logoutBtn">Logout</button></div><div id="dashBody"></div>`;modal(html);$("ordersBtn").onclick=myOrders;if(isAdmin)$("adminBtn").onclick=adminPanel;$("logoutBtn").onclick=async()=>{await db.auth.signOut();profile=null;user=null;closeModal();await refreshUser();toast("Logged out")}}
async function myOrders(){
 if(!user)return auth();let r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,platform_commission,delivery_address,created_at,order_items(product_title,unit_price,quantity,seller_amount,commission_amount)").eq("customer_id",user.id).order("created_at",{ascending:false});
 let h="<h3>My Orders</h3>"+((r.data||[]).map(o=>`<div class="order"><b>${esc(o.order_number)}</b><span class="status">${esc(o.status)}</span><div>${new Date(o.created_at).toLocaleString("en-IN")} · COD · ${money(o.subtotal)}</div><small>${(o.order_items||[]).map(i=>esc(i.product_title)+" × "+i.quantity).join(", ")}</small></div>`).join("")||"<p>No orders yet.</p>");$("dashBody").innerHTML=h}
async function checkout(items=cart){
 if(!user){auth();return}
 if(!items.length){modal("<h2>Cart is empty</h2><p>Add products first.</p>");return}
 const total=items.reduce((s,i)=>s+Number(i.price)*i.qty,0);
 modal(`<h2>COD Checkout</h2><div class="notice"><b>Cash on Delivery only.</b><br>No UPI or online payment is collected.</div><div class="summary">${items.map(i=>`<div class="lineitem"><span>${esc(i.title)} × ${i.qty}</span><b>${money(i.price*i.qty)}</b></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(total)}</b></div></div><label>Full name</label><input id="coName" value="${esc(profile?.full_name||"")}"><label>Mobile</label><input id="coPhone" value="${esc(profile?.phone||"")}" inputmode="tel"><label>Delivery address</label><textarea id="coAddress" rows="4" placeholder="House, village/city, district, PIN"></textarea><button class="primary wide" id="placeOrder" type="button">Place COD Order</button><p id="coMsg"></p>`);
 $("placeOrder").onclick=async()=>{let n=$("coName").value.trim(),ph=$("coPhone").value.trim(),addr=$("coAddress").value.trim(),m=$("coMsg");if(!n||!/^[0-9]{10}$/.test(ph)||!addr){m.textContent="Enter name, valid 10-digit mobile and full address.";return}m.textContent="Placing order…";let number="RET"+Date.now().toString().slice(-10);let o=await db.from("orders").insert({customer_id:user.id,order_number:number,status:"placed",payment_method:"cod",payment_status:"pending",subtotal:total,platform_commission:total*.10,delivery_address:{name:n,phone:ph,address:addr}}).select("id,order_number").single();if(o.error){m.textContent=o.error.message;return}let rows=items.map(i=>({order_id:o.data.id,product_id:i.id,seller_id:i.seller_id,product_title:i.title,unit_price:i.price,quantity:i.qty,seller_amount:i.price*i.qty*.90,commission_amount:i.price*i.qty*.10}));let ir=await db.from("order_items").insert(rows);if(ir.error){await db.from("orders").delete().eq("id",o.data.id);m.textContent=ir.error.message;return}cart=[];saveCart();notifyWhatsApp(o.data.order_number,items,total,n,ph,addr);}}
function notifyWhatsApp(orderNumber,items,total,name,phone,address){
 const text="RETAIL ORDER "+orderNumber+"\n"+items.map(i=>i.title+" x "+i.qty+" = ₹"+(i.price*i.qty)).join("\n")+"\nTotal: ₹"+total+"\nPayment: Cash on Delivery\nCustomer: "+name+"\nMobile: "+phone+"\nAddress: "+address;
 modal('<h2>Order placed ✓</h2><p>Your COD order <b>'+esc(orderNumber)+'</b> has been saved.</p><p class="notice">Tap below to send the order details to RETAIL WhatsApp. WhatsApp will ask you to press Send.</p><a class="primary wide waLink" target="_blank" rel="noopener" href="https://wa.me/917310807043?text='+encodeURIComponent(text)+'">Send order to WhatsApp</a><button class="dash wide" id="doneOrder" type="button">Done</button>');
 $("doneOrder").onclick=closeModal;
}
function cartModal(){if(!cart.length){modal("<h2>Your cart is empty</h2><p>Choose a live product to add it here.</p>");return}let h=`<h2>Your Cart</h2>${cart.map((i,idx)=>`<div class="cartrow"><div><b>${esc(i.title)}</b><br><small>${money(i.price)} each</small></div><div class="qty"><button data-q="${idx}" data-d="-1">−</button><b>${i.qty}</b><button data-q="${idx}" data-d="1">+</button><button class="remove" data-r="${idx}">×</button></div></div>`).join("")}<div class="lineitem"><b>Total</b><b>${money(cart.reduce((s,i)=>s+i.price*i.qty,0))}</b></div><button class="primary wide" id="checkoutBtn" type="button">Checkout — COD</button>`;modal(h);document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{let i=cart[+b.dataset.q];i.qty=Math.max(1,i.qty+ +b.dataset.d);saveCart();cartModal()});document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{cart.splice(+b.dataset.r,1);saveCart();cartModal()});$("checkoutBtn").onclick=()=>checkout(cart)}
function showProduct(id,buy=false){let p=getP(id);if(!p)return;let related=products.filter(x=>x.id!==p.id&&x.category===p.category).slice(0,4);modal(`<div class="detail">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:`<div class="detailemoji">${p.emoji||"📦"}</div>`}<div><span class="tag">${esc(p.category)}</span><h2>${esc(p.title)}</h2><p>${esc(p.description||"Quality product from RETAIL seller.")}</p><div class="bigprice">${money(price(p))} ${off(p)?`<del>${money(p.mrp)}</del><span class="off">${off(p)}% OFF</span>`:""}</div><p>Brand: ${esc(p.brand||"—")} · Stock: ${p.stock??0}</p><button class="primary wide" id="detailAdd">Add to Cart</button> <button class="buy wide" id="detailBuy">Buy Now</button></div></div><h3>Similar products</h3><div class="related">${related.map(x=>`<button data-rel="${x.id}">${esc(x.title)}<br><b>${money(price(x))}</b></button>`).join("")||"<span>No similar products yet.</span>"}</div>`);$("detailAdd").onclick=()=>addToCart(p.id);$("detailBuy").onclick=()=>checkout([{id:p.id,title:p.title,price:price(p),image_url:p.image_url,seller_id:p.seller_id,qty:1}]);document.querySelectorAll("[data-rel]").forEach(x=>x.onclick=()=>showProduct(x.dataset.rel))}
async function sellerPanel(){
 if(!user){auth();return}
 let r=await db.from("seller_profiles").select("*").eq("user_id",user.id).maybeSingle(),sp=r.data;
 if(!sp){modal(`<h2>Become a seller</h2><p>Apply once. After admin approval you can list products.</p><label>Store name</label><input id="storeName" placeholder="Your store"><button class="primary wide" id="applySeller">Submit application</button><p id="sellerMsg"></p>`);$("applySeller").onclick=async()=>{let s=$("storeName").value.trim(),m=$("sellerMsg");if(!s){m.textContent="Enter store name.";return}let x=await db.from("seller_profiles").insert({user_id:user.id,store_name:s,status:"pending",commission_percent:10});m.textContent=x.error?x.error.message:"Application submitted. Wait for admin approval.";};return}
 let approved=sp.status==="approved";modal(`<h2>Seller Dashboard</h2><p>Store: <b>${esc(sp.store_name)}</b> · Status: <b>${esc(sp.status)}</b> · Commission: 10%</p>${approved?`<button class="primary wide" id="addProduct">Add Product</button><button class="dash wide" id="myProducts">My Products</button><button class="dash wide" id="sellerOrders">Seller Orders</button><div id="sellerBody"></div>`:"<p class='notice'>Admin approval is required before you can add products.</p>"}`);if(approved){$("addProduct").onclick=()=>productForm();$("myProducts").onclick=()=>sellerProducts();$("sellerOrders").onclick=()=>sellerOrders()}}
async function sellerProducts(){
 let r=await db.from("products").select("id,title,price,mrp,sale_price,stock,image_url,status,category_id,categories:category_id(name)").eq("seller_id",user.id).order("created_at",{ascending:false});$("sellerBody").innerHTML=(r.data||[]).map(p=>`<div class="adminrow"><span><b>${esc(p.title)}</b><br>${money(p.sale_price??p.price)} · stock ${p.stock} · ${p.status}</span><span><button data-edit="${p.id}">Edit</button><button data-del="${p.id}" class="danger">Delete</button></span></div>`).join("")||"<p>No products.</p>";document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>productForm(b.dataset.edit));document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del))}
async function productForm(id){
 let p=id?getP(id):null;let h=`<h2>${p?"Edit":"Add"} Product</h2><label>Title</label><input id="pt" value="${esc(p?.title||"")}"><label>Brand</label><input id="pb" value="${esc(p?.brand||"")}"><label>Category</label><select id="pc">${categories.map(c=>`<option value="${c.id}" ${p?.category_id===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select><label>Description</label><textarea id="pd">${esc(p?.description||"")}</textarea><div class="twocol"><div><label>MRP</label><input id="pm" type="number" value="${p?.mrp||""}"></div><div><label>Sale price</label><input id="ps" type="number" value="${p?.sale_price??p?.price??""}"></div></div><label>Stock</label><input id="pk" type="number" value="${p?.stock??0}"><label>Product image</label><input id="pi" type="file" accept="image/*"><button class="primary wide" id="saveProduct" type="button">Save Product</button><p id="pmg"></p>`;modal(h);$("saveProduct").onclick=async()=>{let m=$("pmg"),title=$("pt").value.trim(),mrp=+$("pm").value,sale=+$("ps").value,stock=+$("pk").value;if(!title||!sale){m.textContent="Title and sale price are required.";return}let image=p?.image_url||null,file=$("pi").files[0];if(file){let path=(user.id)+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),up=await db.storage.from("product-images").upload(path,file,{upsert:false});if(up.error){m.textContent=up.error.message;return}image=db.storage.from("product-images").getPublicUrl(path).data.publicUrl}let data={title,brand:$("pb").value.trim()||null,category_id:$("pc").value,description:$("pd").value.trim(),mrp,sale_price:sale,price:sale,stock,image_url:image,status:"active",seller_id:user.id};let x=id?await db.from("products").update(data).eq("id",id):await db.from("products").insert(data);m.textContent=x.error?x.error.message:"Saved ✓";if(!x.error){await load();setTimeout(closeModal,600)}} }}
async function deleteProduct(id){
 if(!confirm("Delete this product?"))return;
 let p=getP(id),x=await db.from("products").delete().eq("id",id);
 if(x.error){toast(x.error.message);return}
 if(p?.image_url){try{let u=new URL(p.image_url);let marker="/product-images/";let i=u.pathname.indexOf(marker);if(i>=0)await db.storage.from("product-images").remove([decodeURIComponent(u.pathname.slice(i+marker.length))])}catch(e){}}
 await load();sellerProducts()
}
async function sellerOrders(){let r=await db.from("orders").select("id,order_number,status,subtotal,delivery_address,created_at,order_items(product_title,unit_price,quantity,seller_id,seller_amount)").order("created_at",{ascending:false});$("sellerBody").innerHTML=(r.data||[]).filter(o=>(o.order_items||[]).some(i=>i.seller_id===user.id)).map(o=>`<div class="order"><b>${esc(o.order_number)}</b> · ${esc(o.status)} · ${money(o.subtotal)}<br><small>${esc(o.delivery_address?.name||"")} · ${esc(o.delivery_address?.phone||"")} · ${esc(o.delivery_address?.address||"")}</small></div>`).join("")||"<p>No seller orders.</p>"}
async function adminPanel(){
 if(profile?.role!=="admin"){toast("Admin access only");return}
 modal("<h2>Admin Dashboard</h2><div class='dashgrid'><button class='dash' id='admS'>Sellers</button><button class='dash' id='admP'>Products</button><button class='dash' id='admO'>Orders</button></div><div id='adminBody'></div>");$("admS").onclick=adminSellers;$("admP").onclick=adminProducts;$("admO").onclick=adminOrders}
async function adminSellers(){let r=await db.from("seller_profiles").select("*").order("created_at",{ascending:false});$("adminBody").innerHTML=(r.data||[]).map(s=>`<div class="adminrow"><span><b>${esc(s.store_name)}</b><br>${s.status} · ${s.commission_percent}%</span><span><button data-as="${s.user_id}" data-st="approved">Approve</button><button data-as="${s.user_id}" data-st="rejected" class="danger">Reject</button></span></div>`).join("")||"<p>No seller applications.</p>";document.querySelectorAll("[data-as]").forEach(b=>b.onclick=async()=>{let x=await db.from("seller_profiles").update({status:b.dataset.st}).eq("user_id",b.dataset.as);if(x.error)toast(x.error.message);else adminSellers()})}
async function adminProducts(){let r=await db.from("products").select("id,title,sale_price,stock,status,seller_id,profiles:seller_id(full_name),categories:category_id(name)").order("created_at",{ascending:false});$("adminBody").innerHTML=`<button class="primary" id="adminAdd">Add product</button>`+(r.data||[]).map(p=>`<div class="adminrow"><span><b>${esc(p.title)}</b><br>${money(p.sale_price??0)} · ${p.stock} · ${p.status} · ${esc(p.profiles?.full_name||"")}</span><span><button data-ap="${p.id}">Edit</button><button data-adp="${p.id}" class="danger">Delete</button></span></div>`).join("");$("adminAdd").onclick=()=>productForm();document.querySelectorAll("[data-ap]").forEach(b=>b.onclick=()=>productForm(b.dataset.ap));document.querySelectorAll("[data-adp]").forEach(b=>b.onclick=async()=>{if(confirm("Delete product?")){await db.from("products").delete().eq("id",b.dataset.adp);adminProducts()}})}
async function adminOrders(){let r=await db.from("orders").select("id,order_number,status,payment_method,payment_status,subtotal,delivery_address,created_at,order_items(product_title,quantity)").order("created_at",{ascending:false});$("adminBody").innerHTML=(r.data||[]).map(o=>`<div class="order"><b>${esc(o.order_number)}</b> · ${money(o.subtotal)} · COD<br><small>${esc(o.delivery_address?.name||"")} · ${esc(o.delivery_address?.phone||"")} · ${esc(o.delivery_address?.address||"")}</small><select data-os="${o.id}"><option ${o.status==="placed"?"selected":""}>placed</option><option ${o.status==="confirmed"?"selected":""}>confirmed</option><option ${o.status==="packed"?"selected":""}>packed</option><option ${o.status==="shipped"?"selected":""}>shipped</option><option ${o.status==="delivered"?"selected":""}>delivered</option><option ${o.status==="cancelled"?"selected":""}>cancelled</option></select></div>`).join("")||"<p>No orders.</p>";document.querySelectorAll("[data-os]").forEach(s=>s.onchange=async()=>{let x=await db.from("orders").update({status:s.value}).eq("id",s.dataset.os);if(x.error)toast(x.error.message)})}
$("searchBtn").onclick=render;$("search").oninput=render;$("shopNow").onclick=()=>$("products").scrollIntoView({behavior:"smooth"});$("cats").onclick=e=>{let b=e.target.closest("[data-cat]");if(b){active=b.dataset.cat;renderCats();render()}};$("loginBtn").addEventListener("click",e=>{e.preventDefault();auth().catch(err=>{console.error("RETAIL login click failed:",err);alert("Login could not open. Refresh RETAIL and try again.");});});$("accountBtn").addEventListener("click",e=>{e.preventDefault();account().catch(err=>{console.error("RETAIL account failed:",err);toast("Could not open account. Please refresh.");});});$("cartBtn").addEventListener("click",e=>{e.preventDefault();cartModal();});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});
// Keep this callback synchronous: do not make Supabase requests inside it.
db.auth.onAuthStateChange((_event, session)=>{
 user=session?.user||null;
 if(!user){profile=null;$("loginBtn").hidden=false;$("accountBtn").hidden=true;}
 else{$("loginBtn").hidden=true;$("accountBtn").hidden=false;}
});
load().catch(e=>{console.error("RETAIL startup:",e);const n=$("resultCount");if(n)n.textContent="Catalogue unavailable";const p=$("products");if(p)p.innerHTML="<div class=\"empty\">The live catalogue could not be loaded. Please refresh the page.</div>"});
if("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))).catch(()=>{});
refreshUser().catch(e=>{console.error("RETAIL account startup:",e);$("loginBtn").hidden=false;$("accountBtn").hidden=true;});$("loginBtn").hidden=false;$("accountBtn").hidden=true;});
